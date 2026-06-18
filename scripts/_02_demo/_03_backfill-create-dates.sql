-- backfill-create-dates.sql
--
-- Copies displaydate → createdate on the objectentry table for
-- ForumThread and ForumMessage object entries only.
--
-- Both columns are TIMESTAMP (Types.TIMESTAMP in JDBC / DATE in Liferay DDL),
-- so there is no precision mismatch.
--
-- Run this AFTER the create-demo-data.py script has populated all entries.
-- After running, clear the Liferay entity cache (Control Panel → Server
-- Administration → "Clear All" under Actions → "Clear All Caches").

-- ForumThread entries
UPDATE objectentry
SET    createdate    = displaydate,
       modifieddate  = displaydate
WHERE  objectdefinitionid = (
           SELECT objectdefinitionid
           FROM   objectdefinition
           WHERE  name = 'C_ForumThread'
       )
AND    displaydate IS NOT NULL;

-- ForumMessage entries
UPDATE objectentry
SET    createdate    = displaydate,
       modifieddate  = displaydate
WHERE  objectdefinitionid = (
           SELECT objectdefinitionid
           FROM   objectdefinition
           WHERE  name = 'C_ForumMessage'
       )
AND    displaydate IS NOT NULL;
