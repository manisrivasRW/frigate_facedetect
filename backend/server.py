from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()

db = os.getenv("PG_DB")
user = os.getenv("PG_USERNAME")
password = os.getenv("PG_PASSWORD")
host = os.getenv("PG_HOST")
port = os.getenv("PG_PORT")

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

def get_fids_threshold(min_threshold):
    """
    Returns a dictionary {id: [fid1, fid2, ...]} for thresholds >= min_threshold.
    """
    query = """
    SELECT id, jsonb_agg(fid) AS fids
    FROM suspects
    CROSS JOIN LATERAL jsonb_each(thresholds) AS kv(key, value)
    CROSS JOIN LATERAL jsonb_array_elements_text(value) AS fid
    WHERE key::int >= %s
    GROUP BY id;
    """
    cur.execute(query, (min_threshold,))
    results = cur.fetchall()
    return {row[0]: row[1] for row in results}

def get_faces_by_ids(id):
    query =  """
        SELECT f_id, event_id, camera, start_time, end_time, img_url
        FROM faces
        WHERE f_id = %s;
    """
    cur.execute(query, (id,))
    results = cur.fetchone()
    return results

def get_criminal_record(c_id):
    query = """
        SELECT id,criminal_id, name, age, address,img_url from nagpur_criminals 
        WHERE id = %s;
    """
    cur.execute(query,(c_id,))
    result = cur.fetchone()
    doc = {
        "criminal_id": result[0],
        "c_id": result[1],
        "criminal_name": result[2],
        "criminal_age": result[3],
        "criminal_address": result[4],
        "criminal_img": result[5]
    }
    return doc

@app.post("/get-criminals")
async def get_criminals(request: Request):
    try:
        data = await request.json()
        threshold = data.get("threshold")/10
        # threshold = threshold*10
        # print(threshold)
        print("threshold")
        if threshold is None:
            raise HTTPException(status_code=400, detail="Threshold is required")
        
        criminals = get_fids_threshold(int(threshold))
        print("criminals")
        results = []
        for c_id in criminals:
    
            doc = {
                "criminal_data": get_criminal_record(c_id),
                "suspect_list": criminals[c_id]
            }
            results.append(doc)
        print("result")
        return results
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/get-suspects")
async def get_suspects(request: Request):
    try:
        data = await request.json()
        suspect_ids = data.get("suspect_ids")  

        if not suspect_ids:
            raise HTTPException(status_code=400, detail="suspect_ids is required")

        result = []

        for id in suspect_ids:
            face_data = get_faces_by_ids(id)
            if face_data:
                result.append({
                    "f_id": face_data[0],
                    "event_id": face_data[1],
                    "camera": face_data[2],
                    "start_time": face_data[3],
                    "end_time": face_data[4],
                    "img_url": face_data[5]
                })

        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)



