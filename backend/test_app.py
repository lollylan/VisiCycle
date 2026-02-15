import requests
import datetime

BASE_URL = "http://localhost:8000"

def test_flow():
    print("Testing Backend...")
    
    # 1. Create Patients
    patients = [
        {"name": "Patient A", "address": "Juliuspromenade 19", "interval_days": 1, "visit_duration_minutes": 30},
        {"name": "Patient B", "address": "Schweinfurter Str. 4", "interval_days": 1, "visit_duration_minutes": 45},
        {"name": "Patient C", "address": "Rottendorfer Str. 30", "interval_days": 14, "visit_duration_minutes": 20}
    ]
    
    for p in patients:
        try:
            res = requests.post(f"{BASE_URL}/patients/", json=p)
            print(f"Created {p['name']}: {res.status_code}")
           # print(res.json())
        except Exception as e:
            print(f"Failed to create {p['name']}: {e}")

    # 2. Get All Patients
    res = requests.get(f"{BASE_URL}/patients/")
    all_patients = res.json()
    print(f"Total Patients: {len(all_patients)}")
    
    # 3. Get Today's Plan (Should include A and B because interval is 1 day, so due tomorrow/today)
    # Wait, if interval is 1, next visit is tomorrow?
    # Logic in main.py: if next_visit_date <= now + 1 day
    # So yes, they should be included.
    res = requests.get(f"{BASE_URL}/planner/today")
    plan = res.json()
    print(f"Patients in Today's Plan: {len(plan)}")
    for p in plan:
        print(f" - {p['name']} ({p['address']})")

if __name__ == "__main__":
    test_flow()
