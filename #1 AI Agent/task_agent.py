import requests

# read task from file
def read_tasks(filepath):
    with open(filepath, "r") as f:
        return f.read()

# make a call to open ai with prompt to categorize our tasks
def summarize_tasks(tasks):
    # The f allows Python to insert the variable value.
    prompt = f"""
    you are a smart task planning agent.
    Given a list of tasks, categorize them into 3 priority buckets:
    - High Priority
    - Medium Priority
    - Low Priority

    Tasks: 
    {tasks}

    Return the response in this format:
    High Priority: 
    - task 1
    - task 2

    Medium Priority:
    - task 1
    - task 2

    Low Priority:
    ...
"""
    response = requests.post(
    "http://localhost:11434/api/generate",
    json={
        "model": "gemma3:1b",
        "prompt": prompt,
        "stream": False
    },
    timeout=120
    )

    response.raise_for_status()
    return response.json()["response"]

# to run this
if __name__ == "__main__":
    task_text = read_tasks("tasks.txt")
    summary = summarize_tasks(task_text)

    print("\n Task Summary \n")
    print("-" * 30)
    print(summary)


#HOW IS THIS AN AI AGENT
    # goal
    # tool OLLAMA
    # Memory(yes or not both)
    # planning
    # execution 





























# GEMINI ---------------------
# import os
# from dotenv import load_dotenv
# from google import genai

# # load env
# load_dotenv()

# client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# # read task from file
# def read_tasks(filepath):
#     with open(filepath, "r") as f:
#         return f.read()

# # make a call to open ai with prompt to categorize our tasks
# def summarize_tasks(tasks):
#     # The f allows Python to insert the variable value.
#     prompt = f"""
#     you are a smart task planning agent.
#     Given a list of tasks, categorize them into 3 priority buckets:
#     - High Priority
#     - Medium Priority
#     - Low Priority

#     Tasks: 
#     {tasks}

#     Return the response in this format:
#     High Priority: 
#     - task 1
#     - task 2

#     Medium Priority:
#     - task 1
#     - task 2

#     Low Priority:
#     ...
# """
#     response = client.models.generate_content(
#         #create new chat
#         model="gemini-2.0-flash",
#         contents=prompt
#     )
#     return response.text

# # to run this
# if __name__ == "__main__":
#     task_text = read_tasks("tasks.txt")
#     summary = summarize_tasks(task_text)

#     print("\n Task Summary \n")
#     print("-" * 30)
#     print(summary)
















# OPEN AI ---------------------------------
# import os
# from dotenv import load_dotenv
# from openai import OpenAI

# # load env
# load_dotenv()

# client = OpenAI()

# # read task from file
# def read_tasks(filepath):
#     with open(filepath, "r") as f:
#         return f.read()

# # make a call to open ai with prompt to categorize our tasks
    
# def summarize_tasks(tasks):
#     # The f allows Python to insert the variable value.
#     prompt = f"""
#     you are a smart task planning agent.
#     Given a list of tasks, categorize them into 3 priority buckets:
#     - High Priority
#     - Medium Priority
#     - Low Priority

#     Tasks: 
#     {tasks}

#     Return the response in this format:
#     High Priority: 
#     - task 1
#     - task 2

#     Medium Priority:
#     - task 1
#     - task 2

#     Low Priority:
#     ...
# """

#     #create new chat
#     response = client.chat.completions.create(
#         #which model to use
#         model = "gpt-4o",

#         #send the message, array of msg, inside this dictionary
#         messages = [
#             {"role": "user", "content": prompt}
#         ]
#     )

#     return response.choices[0].message.content

# # to run this
# if __name__ == "__main__":
#     task_text = read_tasks("tasks.txt")
#     summary = summarize_tasks(task_text)

#     print("\n Task Summary \n")
#     print("-" * 30)
#     print(summary)
