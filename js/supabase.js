
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://jpmfssyssfnyctwvwkli.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_yvQ_PZ0C7l6bXMkiFaUQxw_VnMQV27B";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
