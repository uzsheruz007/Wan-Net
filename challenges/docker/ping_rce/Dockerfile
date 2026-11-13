FROM python:3.9-slim

RUN apt-get update && apt-get install -y --no-install-recommends iputils-ping && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir flask==3.1.1 && useradd -m ctfuser

WORKDIR /app
COPY app.py .

# Flag repoda saqlanmaydi: manage.py init_docker_challenges --build uni tasodifiy yaratib, shu yerga beradi
ARG FLAG
RUN test -n "$FLAG" && echo "$FLAG" > /flag.txt && chmod 444 /flag.txt

USER ctfuser
EXPOSE 5000
CMD ["python", "app.py"]
