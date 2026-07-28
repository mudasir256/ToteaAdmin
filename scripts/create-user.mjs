import { createClient } from "@supabase/supabase-js";

const [fullName, email, password] = process.argv.slice(2);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!fullName || !email || !password) {
  console.error('Usage: node scripts/create-user.mjs "Full Name" email@example.com "secure-password"');
  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: {
    full_name: fullName,
  },
});

if (error) {
  console.error(`Could not create user: ${error.message}`);
  process.exit(1);
}

console.log(`Created ${data.user.email} with profile ${data.user.id}.`);
