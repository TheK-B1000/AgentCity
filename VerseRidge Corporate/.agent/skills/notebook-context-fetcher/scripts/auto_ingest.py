import os
import sys

def list_notebook_briefs(directory):
    briefs = []
    if not os.path.exists(directory):
        print(f"Directory {directory} not found.")
        return []
    
    for filename in os.listdir(directory):
        if filename.endswith(".md"):
            with open(os.path.join(directory, filename), 'r', encoding='utf-8') as f:
                content = f.read()
                if "#notebooklm" in content.lower():
                    briefs.append(filename)
    return briefs

if __name__ == "__main__":
    search_dir = sys.argv[1] if len(sys.argv) > 1 else "./.agent/docs/"
    found = list_notebook_briefs(search_dir)
    print("Found NotebookLM Briefs:")
    for b in found:
        print(f"- {b}")
