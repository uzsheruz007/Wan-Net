from flask import Flask, request, render_template_string
import subprocess
import re

app = Flask(__name__)

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Wan-Net | Network Diagnostic Tool</title>
    <style>
        body { background-color: #1a1a2e; color: #e94560; font-family: monospace; padding: 50px; }
        .container { max-width: 600px; margin: 0 auto; border: 1px solid #16213e; padding: 20px; box-shadow: 0 0 10px #0f3460; }
        h1 { text-align: center; color: #0f3460; text-shadow: 0 0 5px #e94560; }
        input[type="text"] { width: 70%; padding: 10px; background: #16213e; border: 1px solid #e94560; color: #fff; }
        button { width: 25%; padding: 10px; background: #e94560; border: none; color: white; cursor: pointer; }
        .output { background: #000; padding: 15px; margin-top: 20px; border-radius: 5px; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Server Status Checker</h1>
        <p>Enter IP address to ping:</p>
        <form method="POST">
            <input type="text" name="target" placeholder="127.0.0.1" required>
            <button type="submit">PING</button>
        </form>
        {% if output %}
            <div class="output">{{ output }}</div>
        {% endif %}
    </div>
</body>
</html>
"""

def firewall(command):
    # WAF: Block 'cat', 'flag', spaces, semi-colons, pipes, ampersands
    blacklist = ['cat', 'flag', ' ', ';', '|', '&', '$']
    for bad in blacklist:
        if bad in command:
            return False, f"Malicious input detected: '{bad}' is blocked!"
    return True, ""

@app.route('/', methods=['GET', 'POST'])
def index():
    output = ""
    if request.method == 'POST':
        target = request.form.get('target', '')
        
        # 1. WAF Check
        is_safe, message = firewall(target)
        if not is_safe:
            return render_template_string(HTML_TEMPLATE, output=message)

        # 2. Vulnerable Execution
        try:
            # VULNERABILITY: shell=True allowed here
            cmd = f"ping -c 1 {target}"
            result = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT, timeout=5)
            output = result.decode('utf-8')
        except subprocess.CalledProcessError as e:
            output = e.output.decode('utf-8')
        except Exception as e:
            output = str(e)

    return render_template_string(HTML_TEMPLATE, output=output)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
