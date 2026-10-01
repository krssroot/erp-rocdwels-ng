INSERT INTO public.notifications (user_id, title, body, kind, link, read)
SELECT DISTINCT user_id, 'Notifications are active', 'You will be alerted here whenever a budget or requisition needs your action.', 'system', '/notifications', false
FROM public.user_roles;