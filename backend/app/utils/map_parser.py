import json
import os


def parse_map_zones(file_path):

    if not os.path.exists(file_path):

        raise FileNotFoundError("File does not exist")


    with open(file_path, 'r') as f:

        data = json.load(f)

    zones = []
    spawn_points = []

    for layer in data["layers"]:

        if  layer["name"] == "Zones":
            for obj in layer["objects"]:
                print(obj["name"])

                if obj["name"].startswith("Spawn"):
                    spawn_points.append({
                        "name": obj["name"],
                        "x": obj["x"],
                        "y": obj["y"]
                    })
                    continue

                zone_data = {
                    "name": obj["name"],
                    "type": "PRIVATE" if "Room" in obj["name"] else "PUBLIC",
                    "bounds": {
                        "x": obj["x"],
                        "y": obj["y"],
                        "width": obj["width"],
                        "height": obj["height"]
                    }
                }
                zones.append(zone_data)


    return zones , spawn_points


