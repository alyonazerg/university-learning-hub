# IMT Idiom Self-Check · pilot MVP

Pilot-only module for one student via a private token link. It does not write to the existing gradebook or revision-test results.

The teacher creates a collection with `POST /learning/imt/collections` using the existing administrator token. The response contains a private `token` and a link ending in `imt-idiom.html#token=...`. The student submits 15 entries, waits for teacher approval, then completes Retrieval and Use in Context. Answers are saved after each question. Results remain pending until the teacher submits an integer 0–3 with a reason through `PUT /learning/imt/collections/{id}/grade`.

Unit 7 material snapshots are loaded from `backend/revision_materials/unit7-b2.json` or `unit7-c1.json`, which contain the Evolve 5/6 Unit 7 vocabulary and grammar notes. Missing units return `verified: false`; the module must not claim overlap checking for Unit 8/9 until `unit8-b2.json`, `unit8-c1.json`, `unit9-b2.json` or `unit9-c1.json` are added from the supplied course materials. The `unit` field is already configurable for those future additions.

The pilot currently uses text answers. Existing private speaking-audio infrastructure can be connected later, but this MVP does not silently treat text as an official oral equivalent and does not call an external AI provider. Preliminary validation and semantic grading are intentionally the next phase after the single-student workflow is accepted.
