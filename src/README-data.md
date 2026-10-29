# Asterism: data folder

This folder is the database of the Asterism. Open `register.html` (one level up) in Chrome or Edge and choose this folder.
All files are plain text and can be read in any editor, but edit them through the app when possible.

| Path | What it is |
|---|---|
| `objects/` | One `.md` file per object. Sub-folders are the folders you see in the app. |
| `objects/**/_folder.yaml` | Folder settings (`default_template` for new objects in that folder). |
| `_templates/*.yaml` | Object templates: id prefix, icon, colour, fields, suggested relations. |
| `_relations.yaml` | Relation types (label, inverse label, colour). |
| `_history/<id>/` | Previous versions of each object. A file is written every time an object is saved or deleted. |

## Object file format

```
---
id: ap-0001                 # permanent id, never changes; relations point to it
name: HQ-AP1
template: wifi-ap
tags: [hq, network]
fields:
  IP Address: 10.10.20.11
relations:
  - {type: connected_to, target: sw-0002}
---
Free notes in Markdown.
```

File name is `<id> <name>.md`. The app reads the id from the file content, not from the file name,
so renaming or moving a file does not break relations.
