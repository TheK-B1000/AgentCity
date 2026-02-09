
import os
import glob

source_dir = r"C:\Users\benja\OneDrive\Documents\Obsidian\VRT2\VerseRidgeTwo"
output_file = r"C:\Users\benja\OneDrive\Documents\Google Antigravity\VerseRidge Corporate\.agent\docs\VerseRidge_Obsidian_Export.md"

with open(output_file, 'w', encoding='utf-8') as outfile:
    outfile.write("# VerseRidge Obsidian Export\n\n")
    for filepath in glob.glob(os.path.join(source_dir, "*.md")):
        filename = os.path.basename(filepath)
        outfile.write(f"\n\n# Source: {filename}\n")
        try:
            with open(filepath, 'r', encoding='utf-8') as infile:
                outfile.write(infile.read())
        except Exception as e:
            outfile.write(f"\n[Error reading file: {e}]\n")

print(f"Successfully merged files into {output_file}")
