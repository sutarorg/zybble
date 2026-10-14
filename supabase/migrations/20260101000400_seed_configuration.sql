-- Zybble — seed *product configuration* only.
--
-- This migration inserts the canonical marketplace category taxonomy. It does
-- NOT create courses, instructors, reviews, orders, payouts or any other
-- demonstration business record. An empty catalog is a correct launch state and
-- the storefront renders an empty state rather than invented content.

insert into public.categories (slug, name, short_name, description, icon, sort_order, visible)
values
  ('automation',       'Automation',     'Automation',     'Automate real workflows with agents, APIs and no-code tooling.', 'workflow',   1, true),
  ('development',      'Development',    'Development',    'Build, ship and deploy AI-powered applications end to end.',      'code-2',     2, true),
  ('generative-ai',    'Generative AI',  'Generative AI',  'Master prompting and modern generative models.',                  'sparkles',   3, true),
  ('creation',         'Creation',       'Creation',       'Create video, audio, music and visuals with AI tools.',           'palette',    4, true),
  ('marketing',        'Marketing',      'Marketing',      'Grow faster with AI-driven campaigns, funnels and content.',      'megaphone',  5, true),
  ('data-science',     'Data Science',   'Data Science',   'Analyze data and build machine-learning models in Python.',       'bar-chart-3',6, true),
  ('business',         'Business',       'Business',       'Launch AI products and build companies around them.',             'briefcase',  7, true),
  ('productivity',     'Productivity',   'Productivity',   'Design personal AI systems that save hours every week.',          'timer',      8, true)
on conflict (slug) do update
  set name = excluded.name,
      short_name = excluded.short_name,
      description = excluded.description,
      icon = excluded.icon,
      sort_order = excluded.sort_order;
