import math
from typing import List, Tuple
import models

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance in kilometers between two points 
    on the earth (specified in decimal degrees)
    """
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return float('inf') # Infinite distance if coordinates missing

    # convert decimal degrees to radians 
    lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])

    # haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371 # Radius of earth in kilometers. Use 3956 for miles
    return c * r

def calculate_travel_time_minutes(distance_km, speed_kmh=30, detour_factor=1.3):
    """
    Estimate travel time based on distance, average speed, and a detour factor (straight line vs road).
    Default: 30 km/h average speed in city, 1.3 factor for road winding.
    """
    if distance_km == float('inf'):
        return 15 # Fallback for unknown locations
    
    real_distance = distance_km * detour_factor
    hours = real_distance / speed_kmh
    minutes = round(hours * 60)
    return minutes + 5 # +5 min parking/entry buffer per trip

def optimize_route(start_coords: Tuple[float, float], patients: List[models.Patient]):
    """
    Simple Nearest Neighbor algorithm for TSP.
    start_coords: (lat, lon) of the practice (assumed Würzburg center if not set)
    Returns: List of patients in order.
    Note: Does NOT return the return trip to practice in the list itself, handled by frontend or separate logic.
    """
    # Filter patients with valid coordinates
    valid_patients = [p for p in patients if p.latitude and p.longitude]
    invalid_patients = [p for p in patients if not (p.latitude and p.longitude)]

    if not valid_patients:
        return invalid_patients # No route possible, return in original order or whatever

    route = []
    current_pos = start_coords
    
    # Logic: Find nearest unvisited neighbor
    unvisited = valid_patients.copy()
    
    while unvisited:
        nearest = min(unvisited, key=lambda p: haversine_distance(current_pos[0], current_pos[1], p.latitude, p.longitude))
        route.append(nearest)
        current_pos = (nearest.latitude, nearest.longitude)
        unvisited.remove(nearest)
        
    # Append patients without coordinates at the end
    return route + invalid_patients
