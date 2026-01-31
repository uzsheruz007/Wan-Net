import docker
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

try:
    client = docker.from_env()
except Exception as e:
    logger.error(f"Error initializing Docker client: {e}")
    client = None

def start_container(image_name, port_binding=None):
    """
    Starts a container from the given image name.
    port_binding: dict mapping container port to host port, e.g., {5000: 8001}
    Returns the container object or None.
    """
    if not client:
        logger.error("Docker client is not active.")
        return None
    
    
    # Ensure port keys are strings like "5000/tcp" if they are passing raw ints
    # But checking docs: client.containers.run(ports={'5000/tcp': 8080})
    
    # Let's clean the input to be sure
    safe_ports = {}
    if port_binding:
        for k, v in port_binding.items():
            key = str(k)
            if '/' not in key:
                key = f"{key}/tcp"
            # Explicitly bind to all interfaces to avoid localhost connection refused issues on some setups
            safe_ports[key] = int(v)

    try:
        container = client.containers.run(
            image_name,
            detach=True,
            ports=safe_ports,
            mem_limit='128m',  # Security: Limit memory
            cpu_quota=50000,   # Security: Limit CPU (50%)
            restart_policy={'Name': 'no'},
            remove=True # Auto remove when stopped
        )
        return container
    except docker.errors.ImageNotFound:
        logger.error(f"Image {image_name} not found.")
        return None
    except Exception as e:
        logger.error(f"Error starting container: {e}")
        return None

def stop_container(container_id):
    """Stops a container (auto-removed due to remove=True above)."""
    if not client:
        return False
        
    try:
        container = client.containers.get(container_id)
        container.stop(timeout=2)
        return True
    except Exception as e:
        logger.error(f"Error stopping container {container_id}: {e}")
        return False

def get_container_status(container_id):
    if not client:
        return "error"
    try:
        container = client.containers.get(container_id)
        return container.status
    except docker.errors.NotFound:
        return "not_found"
    except Exception as e:
        logger.error(f"Error getting status for {container_id}: {e}")
        return "error"
