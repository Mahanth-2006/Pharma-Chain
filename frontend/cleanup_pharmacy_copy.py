from pathlib import Path
root = Path('/home/ubuntu/pharma-chain/client/src')
# Rename visible workspace language and remove remaining warning-oriented copy.
hospital = root / 'pages/HospitalDashboard.tsx'
text = hospital.read_text()
text = text.replace('hospital console', 'pharmacy console').replace('point of care', 'pharmacy counter').replace('Pending review', 'Receipts today').replace('Awaiting evidence', 'All receipts queued').replace('<option value="review">Requires review</option>', '<option value="checked">Checked / intact</option>')
hospital.write_text(text)
# Use a pharmacy icon and pharmacy event type in provenance history.
timeline = root / 'components/ProvenanceTimeline.tsx'
text = timeline.read_text().replace('Hospital', 'Pill').replace('type === "hospital"', 'type === "pharmacy"').replace('type: "hospital"', 'type: "pharmacy"')
timeline.write_text(text)
# Remove legacy doctor role literals so the product vocabulary is pharmacy everywhere.
for relative in ['api/client.ts', 'auth/AuthContext.tsx']:
    path = root / relative
    text = path.read_text().replace(' | "doctor"', '').replace(' || role === "doctor"', '')
    path.write_text(text)
