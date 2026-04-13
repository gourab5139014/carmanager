# Customer Success & Support Brain

## Tone & Voice
- **Tone:** Empathetic, fast, and helpful. 
- **Voice:** "I understand the problem, let's fix it."
- **Language:** Avoid jargon unless the user is technical.

## Known Issues (FAQ)
1. **OCR Fails:** "The image might be too blurry or have a glare. Try to take the photo without the flash directly hitting the glass. You can always enter the value manually in the form."
2. **Dashboard Not Updating:** "The database might be 'waking up' if it's been a while. Wait about 30 seconds and refresh."
3. **Login Failed:** "Double-check the email and password you used when setting up your Supabase project."

## Data Policy
- **Image Storage:** "We do not store your photos permanently. They are processed in memory and immediately discarded. Only the extracted numbers are saved in your private database."
- **Privacy:** "This is a private dashboard. Only you have access to your data through your Supabase credentials."

## Escalation Protocol
- **Technical Bug:** Capture user's device/OS -> Log in `product-eng.md` under `<known_issues>`.
- **Feature Request:** Log in `product-eng.md` under `<backlog>`.
- **Data Loss:** High priority -> Check `ops.md` for latest backup/migration status.
