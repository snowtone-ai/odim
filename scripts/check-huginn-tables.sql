select
  to_regclass('public.munin_memory') as munin_memory,
  to_regclass('public.munin_opinions') as munin_opinions,
  to_regclass('public.huginn_eval_log') as huginn_eval_log,
  to_regclass('public.pre_computed_answers') as pre_computed_answers;
