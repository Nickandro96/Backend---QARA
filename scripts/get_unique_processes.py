import json

def get_unique_processes(json_file_path):
    with open(json_file_path, 'r', encoding='utf-8') as f:
        questions_data = json.load(f)

    unique_processes = set()
    for q in questions_data:
        process_name = q.get('process')
        if process_name:
            unique_processes.add(process_name.strip())

    for process in sorted(list(unique_processes)):
        print(process)

# Define file path
json_input_path = "/home/ubuntu/backend-new/server/all-questions-data.json"

# Run the script
get_unique_processes(json_input_path)
