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
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import asyncio
import uvicorn
from dotenv import load_dotenv
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import math

load_dotenv()

app = FastAPI()

origins = [
    "http://localhost:3000",
    "*",  
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    try:
        stored_embeddings = []
        stored_labels = []
        cur.execute("SELECT id, criminal_id, name, father_name, age, address, img_url, embedding FROM public.nagpur_criminals")
        rows = cur.fetchall()
        print(f"Loaded {len(rows)} records from DB")

        for row in rows:
            id_, criminal_id, name, father_name, age, address, img_url, embedding = row

            # Convert embedding (Postgres double precision[]) to numpy array
            embedding_array = np.array(embedding, dtype=np.float32)
            stored_embeddings.append(embedding_array)

            info = {
                "id": id_,
                "criminal_id": criminal_id,
                "name": name,
                "father_name": father_name,
                "age": age,
                "address": address,
                "img_url": img_url
            }
            stored_labels.append(info)

        if stored_embeddings:
            stored_embeddings = np.stack(stored_embeddings)
        else:
            stored_embeddings = np.zeros((0, 512))  # adjust dim if needed

        cur.close()
        conn.close()

    except Exception as e:
        print("Error:", str(e))

load_embeddings_from_db()
print("Loaded embeddings from DB")

face_app = FaceAnalysis(name="buffalo_l")
face_app.prepare(ctx_id=0)
print("FaceAnalysis model prepared")

processed_event_ids = set()

def get_json(url,m_url,camera,t=None):
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json() 
        if data is not None and len(data)>0:
            print(f"{data[0]['start_time']}")
            return data, data[0]['start_time']
        return None, None
    else:
        print("Error:", response.status_code)
        print("Refreshing Wait for 5 minutes..")
        time.sleep(5*60)
        if t is not None:
            url = f"{m_url}?camera={camera}&limit=20&after={t}"
            after_time(url,t,m_url,camera)
        else:
            post_url = "http://localhost:5000/get-data"
            payload = {"url": m_url,"camera": camera}
            try:
                post_response = requests.post(post_url, json=payload)
                print("Called /get-data, status:", post_response.status_code)
            except Exception as e:
                print("Error calling /get-data:", e)

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

def get_faces(data,snapshot_url):
    face_list = []
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
                        faces = get_image(f"{snapshot_url}/{event_id}/snapshot-clean.png",event_id,box,start_time,end_time,camera)
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

def update_url_after(url, timestamp):
    """
    Update or add the 'after' parameter in the URL.
    """
    parts = urlparse(url)
    query = parse_qs(parts.query)
    query['after'] = [str(timestamp)]
    new_query = urlencode(query, doseq=True)
    return urlunparse(parts._replace(query=new_query))

def process(url, m_url,camera):
    print("Processing URL:", url)
    data, timestamp = get_json(url,m_url,camera)
    if data is not None:
        print(f"Got data: {timestamp}")
        face_list = get_faces(data, m_url)
        if face_list and len(face_list) > 0:
            detect_faces(face_list)
        # convert timestamp to integer and add a small delta to avoid fetching same event
        return timestamp
    else:
        print("No data to process")
        return None



def after_time(url, timestamp, m_url, camera):
    """
    Continuously fetch data after the given timestamp.
    """
    while True:
        url_with_after = update_url_after(url, timestamp)
        l_time = process(url_with_after, m_url,camera)
        
        if l_time is not None:
            timestamp = math.ceil(float(l_time))
            print("Updated timestamp:", timestamp)
        else:
            print("No new data, retrying in 1 minute...")
            time.sleep(60)  # wait 1 minute before retry
            after_time(url,timestamp,m_url,camera)

async def background_job(base_url: str, m_url: str, camera: str):
    try:
        # Initial processing
        timestamp = process(base_url, m_url, camera)
        if timestamp is None:
            print("No initial data, retrying in 1 minute...")
            time.sleep(60)  
            timestamp = process(base_url, m_url, camera)

        if timestamp is not None:
            print("Initial timestamp:", timestamp)
            after_time(base_url, math.ceil(float(timestamp)), m_url, camera)
        else:
            print("No data available after retries.")
    except Exception as e:
        print("Background job error:", str(e))


@app.post("/get-data")
async def main(request: Request):
    try:
        data = await request.json()
        m_url = data.get("url")
        camera = data.get("camera")

        base_url = f"{m_url}?camera={camera}&label=person&limit=20"

        # Launch background task
        asyncio.create_task(background_job(base_url, m_url, camera))

        # Respond immediately
        return JSONResponse(
            content={"status": "started", "message": "Processing has been triggered"},
            status_code=200
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

