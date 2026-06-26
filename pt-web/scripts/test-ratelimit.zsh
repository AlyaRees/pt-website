for i in $(seq 1 15); do
  curl -s -o /dev/null -w "Request $i: %{http_code}\n" \
  -X POST http://localhost:3000/api/contact
done

# seq is a terminal command that generates a sequence of numbers

# -s = silent. It is a flag that hides the default progress bar and error messages in the output.

# -o = output (here it is instructed to be sent to /dev/null)

# -w = write out. Tells curl to print a custom message after each request here. 

# %{http_code} is a curl variable for the HTTP status code returned by the server.

# -X allows you to specify the HTTP method (e.g. POST, GET etc).