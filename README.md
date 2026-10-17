# Run the app

Opening `index.html` as a file does not start the app. The browser blocks modules and data loads on `file://`.

## Click to run

Run `bash run.sh`. It starts the server and opens the browser. Press `Ctrl+C` to stop it.

## Steps

1. Open a terminal in this folder.
2. Start a local server:

```powershell
python -m http.server 8765
```

3. Open [http://127.0.0.1:8765](http://127.0.0.1:8765) in the browser.
4. Keep the terminal open while you use the app.
5. Press `Ctrl+C` in the terminal to stop the server.

The 3D view needs internet so the browser can load the graphics engine.
