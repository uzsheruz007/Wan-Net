FROM python:3.12-slim

RUN pip install --no-cache-dir flask==3.1.1 && useradd -m ctfuser

WORKDIR /app
COPY app.py .

# Arxiv papkasi ilova ishga tushganda yaratiladi
RUN mkdir -p /app/docs && chown ctfuser /app/docs
# Flag repoda saqlanmaydi: manage.py init_docker_challenges --build uni tasodifiy yaratib, shu yerga beradi
ARG FLAG
RUN test -n "$FLAG" && echo "$FLAG" > /flag.txt && chmod 444 /flag.txt

USER ctfuser
EXPOSE 5000
CMD ["python", "app.py"]
