## Problems encountered

Issue - When running the application, the old environment variable values for the upstash URL and token were being used after they had been updated. The new values for the variables were not being read from the .env file, meaning that the email function of the website was not working.

If the Upstash database is archived or deleted and you create a new one, you may have to unset the upstash redis rest token and URL in the shell. 
You can do this by executing this command when running the next dev server: env -u UPSTASH_REDIS_REST_URL -u UPSTASH_REDIS_REST_TOKEN npm run dev. However this is a temporary 'fix' and not a solution.

To resolve this issue, you must delete the project on your local machine and reclone the project again from the repository. When you run the new cloned project, you should not encounter the same issue. 