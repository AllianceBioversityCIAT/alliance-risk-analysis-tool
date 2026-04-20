## 2026-04-20 - [Fix Information Disclosure in Assessments]
**Vulnerability:** Assessment existence could be enumerated because `findOne` returned a 403 Forbidden if the user did not own the assessment, but a 404 NotFound if it didn't exist.
**Learning:** `findUnique` followed by an in-memory ownership check leaks information about the existence of records.
**Prevention:** Always verify record ownership at the database level using `findFirst` with a compound condition (e.g., `where: { id, userId }`), and throw a 404 NotFoundException if missing.
