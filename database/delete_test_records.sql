-- ============================================================
-- DELETE TEST RECORDS (UUID rows created by the OLD backend)
-- Run this in Supabase SQL Editor AFTER deploying the new backend
-- ============================================================

-- Test tutor created during verification (old backend generated UUID)
DELETE FROM tutors WHERE id = '6a679d77-2281-4295-908e-62b47d0f487b';

-- Test student created during verification (old backend generated UUID)
DELETE FROM students WHERE id = '07f3b963-3562-47be-ac7f-a2957b08d764';

-- Verify: show any remaining UUID-style IDs (should be none after cleanup)
SELECT 'students' AS tbl, id, name FROM students WHERE id ~ '^[0-9a-f]{8}-'
UNION ALL
SELECT 'tutors' AS tbl, id, name FROM tutors WHERE id ~ '^[0-9a-f]{8}-';