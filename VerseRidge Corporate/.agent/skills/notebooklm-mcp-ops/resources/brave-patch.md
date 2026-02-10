# Brave Browser Patch for NotebookLM MCP

The `notebooklm-mcp-cli` package looks for Chrome in `C:\Program Files\Google\Chrome\Application\chrome.exe` on Windows. If you use **Brave**, you need to patch the browser discovery function.

## File to Patch

```
<python-site-packages>/notebooklm_tools/utils/cdp.py
```

Find your site-packages with:
```bash
python -c "import site; print(site.getsitepackages())"
```

## Change

In `get_chrome_path()`, update the Windows section:

```diff
 elif system == "Windows":
     candidates = [
+        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
         r"C:\Program Files\Google\Chrome\Application\chrome.exe",
+        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
     ]
```

> **Warning:** This patch lives in `site-packages` and will be **overwritten** on package upgrades. Re-apply after running `pip install --upgrade notebooklm-mcp-cli`.
