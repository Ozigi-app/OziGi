import csv

with open("C:/Users/PC/fork/OziGi/github_leads.csv", encoding="utf-8") as f:
    leads = list(csv.DictReader(f))

with open("C:/Users/PC/fork/OziGi/sequence_tracking.csv", encoding="utf-8") as f:
    tracked = {r["email"].lower() for r in csv.DictReader(f)}

not_sent = []
sent = []
for i in range(521, 546):
    email = leads[i]["Email"].lower()
    name = leads[i]["Name"]
    if email in tracked:
        sent.append(i)
    else:
        not_sent.append((i, name, email))

print(f"Leads 521-545 — sent: {len(sent)}, NOT sent: {len(not_sent)}")
if sent:
    print(f"Sent indices: {sent}")
if not_sent:
    print("NOT sent:")
    for i, name, email in not_sent:
        print(f"  [{i}] {name} <{email}>")
