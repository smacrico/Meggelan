from src.ingestion.fit_parser import parse_fit_file
from src.ingestion.sqlite_loader import load_parsed_fit
import os
from pathlib import Path

# Get all .fit files from run_Activities folder
run_activities_dir = Path("run_Activities")
fit_files = sorted(run_activities_dir.glob("*.fit"))

print(f"Found {len(fit_files)} activities to process\n")

# Process each activity file
for fit_file in fit_files:
    try:
        print(f"Processing: {fit_file.name}")
        
        # Parse the fit file
        parsed = parse_fit_file(str(fit_file))
        
        # Load to database
        activity_id = load_parsed_fit(parsed, db_path="C:\\smakrykoDBs\\runAnalysis.db")
        
        fit_data = parsed
        sessions = fit_data["sessions"]
        laps = fit_data["laps"]
        records = fit_data["records"]
        hrv = fit_data["hrv"]
        running_dynamics = fit_data["running_dynamics"]
        developer_fields = fit_data["developer_fields"]
        
        print(f"  Sessions: {len(sessions)}")
        print(f"  Laps: {len(laps)}")
        print(f"  Records: {len(records)}")
        print(f"  Activity ID: {activity_id}")
        print(f"  Loaded successfully\n")
        
    except Exception as e:
        print(f"  Error processing {fit_file.name}: {str(e)}\n")