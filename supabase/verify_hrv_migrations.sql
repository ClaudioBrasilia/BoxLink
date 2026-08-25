-- Consulta somente leitura. Execute no Supabase SQL Editor.
-- Cada linha mostra se a coluna esperada existe na tabela de sessões.
WITH expected(column_group, column_name) AS (
  VALUES
    ('base_hrv', 'rr_intervals_ms'),
    ('base_hrv', 'hrv_rmssd_ms'),
    ('base_hrv', 'hrv_sdnn_ms'),
    ('base_hrv', 'hrv_metric'),
    ('base_hrv', 'hrv_at'),
    ('validation_hrv', 'hrv_validation_status'),
    ('validation_hrv', 'hrv_validation_reason'),
    ('validation_hrv', 'hrv_valid_intervals'),
    ('validation_hrv', 'hrv_total_intervals'),
    ('validation_hrv', 'hrv_valid_ratio'),
    ('validation_hrv', 'hrv_age_sec'),
    ('validation_hrv', 'hrv_source_kind'),
    ('validation_hrv', 'hrv_source_name'),
    ('validation_hrv', 'hrv_source_id'),
    ('validation_hrv', 'hrv_platform'),
    ('validation_hrv', 'hrv_device_id')
)
SELECT
  e.column_group,
  e.column_name,
  CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'heart_rate_sessions'
 AND c.column_name = e.column_name
ORDER BY e.column_group, e.column_name;

-- Resumo: ambas as migrações estarão completas quando os dois grupos estiverem OK.
WITH expected(column_group, column_name) AS (
  VALUES
    ('base_hrv', 'rr_intervals_ms'), ('base_hrv', 'hrv_rmssd_ms'),
    ('base_hrv', 'hrv_sdnn_ms'), ('base_hrv', 'hrv_metric'), ('base_hrv', 'hrv_at'),
    ('validation_hrv', 'hrv_validation_status'), ('validation_hrv', 'hrv_validation_reason'),
    ('validation_hrv', 'hrv_valid_intervals'), ('validation_hrv', 'hrv_total_intervals'),
    ('validation_hrv', 'hrv_valid_ratio'), ('validation_hrv', 'hrv_age_sec'),
    ('validation_hrv', 'hrv_source_kind'), ('validation_hrv', 'hrv_source_name'),
    ('validation_hrv', 'hrv_source_id'), ('validation_hrv', 'hrv_platform'),
    ('validation_hrv', 'hrv_device_id')
)
SELECT
  e.column_group,
  count(*) AS expected_columns,
  count(c.column_name) AS installed_columns,
  CASE WHEN count(*) = count(c.column_name) THEN 'READY' ELSE 'RUN_MIGRATION' END AS group_status
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'heart_rate_sessions'
 AND c.column_name = e.column_name
GROUP BY e.column_group
ORDER BY e.column_group;
