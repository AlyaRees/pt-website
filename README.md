## Problems encountered

When the Upstash database is archived or deleted and you create a new one, you may have to unset the upstash redis rest token and URL in the shell. 
You can do this by executing this command when running the next dev server: env -u UPSTASH_REDIS_REST_URL -u UPSTASH_REDIS_REST_TOKEN npm run dev