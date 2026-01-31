FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y iputils-ping && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install flask

# Create a non-root user
RUN useradd -m ctfuser

# Setup App
WORKDIR /app
COPY app.py .

# Setup Flag (The objective)
RUN echo "WanNet{RCE_byp4ss_m4st3r_3301}" > /flag.txt
RUN chmod 444 /flag.txt

# Switch to non-root user
USER ctfuser

EXPOSE 5000

CMD ["python", "app.py"]
