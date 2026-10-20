# El buzón de los buenos momentos

A buildless, mobile-first landing page for Verdad entre dos, featuring the free **5 citas, 5 recuerdos** collection and direct downloads of its two published PDF editions.

## Run locally

From this directory, start the static preview server:

```bash
python3 -m http.server 4318 --bind 127.0.0.1 --directory dist
```

Open <http://127.0.0.1:4318>. Stop the server with `Ctrl+C`.

Run the native Node test suite with:

```bash
npm test
```

## Add a published resource

Keep the visitor experience direct and truthful: add only a resource that is actually published, copy its finished public file into `dist/downloads/`, and add a visible same-origin download link with its accurate edition details. Add or update a Node test for the real file and its copy before changing the page. Do not expose editable source documents or add an email gate.

This project has no production dependencies, build step, remote font, or runtime third-party request.
