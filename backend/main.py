import json
import requests
import cv2
import uuid
import os
import base64
import time
import psycopg2
import numpy as np  
from insightface.app import FaceAnalysis
from sklearn.metrics.pairwise import cosine_similarity
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

db = os.getenv("PG_DB")
user = os.getenv("PG_USERNAME")
password = os.getenv("PG_PASSWORD")
host = os.getenv("PG_HOST")
port = os.getenv("PG_PORT")

conn = psycopg2.connect(
    host=host,
    database=db,   
    user=user,     
    password=password,
    port = port,
    sslmode='require'
)
cur = conn.cursor()

print("Connected to the database.")

def load_embeddings_from_db(json_paths=None):
    global stored_embeddings, stored_labels
    if json_paths is None:
        # default: load both
        json_paths = [
            "Nagpur_embeddings/embeddings.json"
        ]

    try:
        #print("In load_embeddings_from_json")
        stored_embeddings = []
        stored_labels = []

        for path in json_paths:
            with open(path, "r") as f:
                data = json.load(f)

            print(f"Loaded {len(data)} records from {path}")

            for record in data:
                # embedding stored as list, convert back to numpy array
                embedding = np.array(record["embedding"], dtype=np.float32)
                stored_embeddings.append(embedding)

                info = {
                    "id": record.get("id"),
                    "criminal_id": record.get("criminal_id"),
                    "name": record.get("name"),
                    "father_name": record.get("father_name"),
                    "age": record.get("age"),
                    "address": record.get("address"),
                    "police_station": record.get("police_station"),
                    "crime_and_section": record.get("crime_and_section"),
                    "head_of_crime": record.get("head_of_crime"),
                    "arrested_date": record.get("arrested_date"),
                    "img_url": record.get("img_url")
                }
                stored_labels.append(info)

        if stored_embeddings:
            stored_embeddings = np.stack(stored_embeddings)
        else:
            stored_embeddings = np.zeros((0, 512))  

    except Exception as e:
        print(str(e))

load_embeddings_from_db()
print("Loaded embeddings from DB")

face_app = FaceAnalysis(name="buffalo_l")
face_app.prepare(ctx_id=0)
print("FaceAnalysis model prepared")

processed_event_ids = set()

def get_json(url):
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json() 
        if data is not None and len(data)>0:
            return data, data[0]['start_time']
        return None, None
    else:
        print("Error:", response.status_code)
        return None, None
    
def get_img_url(frame):
    _, buffer = cv2.imencode('.jpg', frame)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    img_url = f"data:image/jpeg;base64,{img_base64}"
    return img_url
    
def get_image(url,event_id,box,start_time,end_time,camera):
    #print(event_id)
    response = requests.get(url)
    frame = cv2.imdecode(np.frombuffer(response.content, np.uint8), cv2.IMREAD_COLOR)
    img_url = get_img_url(frame)
    #cv2.imwrite(img_path, frame)
    data = {
        "event_id": event_id,
        "box": box,
        "start_time": start_time,
        "end_time": end_time,
        "camera": camera,
        "image_url": img_url
    }

    print(f"Got Image for event ID: {event_id}")
    return data

def get_faces(data):
    face_list = []
    snapshort_url = "http://162.243.16.206:5000/api/events"
    if data is not None:
        for result in data:
            if result.get('has_snapshot') is True:
                event_id = result['id']
                if event_id in processed_event_ids:
                    break
                processed_event_ids.add(event_id)
                data = result.get('data')
                start_time = result.get('start_time')
                end_time = result.get('end_time')
                camera = result.get('camera')
                if data and data.get('attributes'):
                    if data.get('box') is not None:
                        box = data['box']
                        faces = get_image(f"{snapshort_url}/{event_id}/snapshot-clean.png",event_id,box,start_time,end_time,camera)
                        face_list.append(faces)
        return face_list
    else:
        print("No faces to process")
        return None
    
def save_face(img_url,event_id,camera,start_time,end_time):
    uniq_id = str(uuid.uuid4())[:16]
    f_id = f"{event_id}_{uniq_id}"

    insert_query = """
    INSERT INTO faces (f_id,event_id, camera, start_time, end_time, img_url)
    VALUES (%s,%s, %s, to_timestamp(%s), to_timestamp(%s), %s)
    RETURNING f_id;
    """

    cur.execute(insert_query, (f_id,event_id, camera, start_time, end_time, img_url))
    f_id = cur.fetchone()[0]
    conn.commit()
    print(f"Inserted face with f_id: {f_id}")
    return f_id
    
def add_suspects(score,thres,id,f_id):
    query = """
    SELECT add_fid(%s, %s, %s, %s);
    """
    score = float(score)
    cur.execute(query,(id, f_id, thres, score))
    conn.commit()
    print(f"Added fid {f_id} to suspect {id} with score {score}")

def detect_faces(face_list):
    if face_list is not None and len(face_list)>0:
        for event in face_list:
            img_url = event["image_url"]
            _, encoded = img_url.split(",", 1)
            image_bytes = base64.b64decode(encoded)
            nparr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            h, w, _ = frame.shape
            x_norm, y_norm, w_norm, h_norm = event["box"]

            x1 = int(x_norm * w)
            y1 = int(y_norm * h)
            x2 = int((x_norm + w_norm) * w)
            y2 = int((y_norm + h_norm) * h)

            img_crop = frame[y1:y2, x1:x2]

            faces = face_app.get(img_crop)
            fh,fw,_ = img_crop.shape
            if faces:
                for face in faces:
                    bbox = face.bbox.astype(int)  
                    fbx1 = bbox[0] + x1
                    fby1 = bbox[1] + y1
                    fbx2 = bbox[2] + x1
                    fby2 = bbox[3] + y1

                    b_frame = frame.copy()
                    cv2.rectangle(b_frame,(x1,y1),(x2,y2),(0,255,0),2)
                    cv2.rectangle(b_frame,(fbx1,fby1),(fbx2,fby2),(0,0,255),2)

                    #f_img = frame[fby1:fby2, fbx1:fbx2]
                    img_url = get_img_url(b_frame)
                    f_id = save_face(img_url,event["event_id"],event["camera"],event["start_time"],event["end_time"])

                    emb = face.embedding
                    emb = emb / np.linalg.norm(emb)
                    emb = emb.reshape(1, -1)
                    sims = cosine_similarity(emb, stored_embeddings)[0]

                    for idx,score in enumerate(sims):
                        if stored_labels[idx]['id'] == 'test_rathu':
                            continue
                        if score < 0.2:
                            continue
                        print(f"Score: {score:.4f}")
                        thres = int(score*10)
                        add_suspects(score,thres,stored_labels[idx]['id'],f_id)
            else:
                print("No faces detected in the cropped image.")
    else:
        print("No face data available")
    
    print("No faces to process")
    return None

def process(url):
    data,timestamp = get_json(url)
    if data is not None:
        face_list = get_faces(data)
        if face_list is not None and len(face_list)>0:
            detect_faces(face_list)
        return timestamp
    else:
        print("No data to process")
        return None
    
def after_time(url,timestamp):
    url = f"{url}&after={timestamp}"
    l_timestamp = int(process(url))
    if l_timestamp is not None:
        print("Processing After timestamp:", l_timestamp)
        after_time(url,l_timestamp)
    else:
        print("No new data after timestamp")
        print("Retrying in 1 minute...")
        time.sleep(60)
        after_time(url,timestamp)
    
        
def main():
    url = "http://162.243.16.206:5000/api/events?camera=mumbaidevi2&label=person"
    
    try:  #after=<timestamp>
        timestamp = int(process(url))
        print("Initial processing Latest timestamp:", timestamp)
        if timestamp is None:
            print("No initial data, retrying in 1 minute...")
            time.sleep(60)
            main()
        else:
            after_time(url,timestamp)

    except Exception as e:
        print("Error:", str(e))
        print("Restarting in 3 minutes...")
        time.sleep(3 * 60)
        main()

if __name__ == "__main__":
    main()
