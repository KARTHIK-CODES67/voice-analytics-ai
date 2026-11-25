import glob, json, os, urllib.request

results = []
for idx, path in enumerate(sorted(glob.glob('synthetic_calls/*.txt')), 1):
    transcript = open(path, encoding='utf-8').read().strip()
    prompt = (
        'Analyze this call transcript and respond ONLY with valid JSON: '
        '{"call_outcome": "SUCCESSFUL" or "UNSUCCESSFUL", '
        '"reason": "1-sentence clear explanation of why the call succeeded or failed", '
        '"category": "RENEWAL_CONFIRMED" | "DISCOUNT_ACCEPTED" | "COMPETITOR_SWITCH" | "NETWORK_DROP", '
        '"sentiment": "POSITIVE" | "NEUTRAL" | "ANNOYED", '
        '"key_quote": "most important customer sentence", '
        '"next_action": "recommended follow-up"}\n\nTranscript:\n' + transcript
    )
    req = urllib.request.Request(
        'http://127.0.0.1:11434/api/generate',
        data=json.dumps({'model': 'qwen2.5:3b', 'prompt': prompt, 'stream': False, 'format': 'json'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    analysis = json.loads(json.loads(urllib.request.urlopen(req).read().decode())['response'])
    analysis.update({'call_id': f'CALL-{idx:03d}', 'source_file': os.path.basename(path), 'transcript': transcript})
    results.append(analysis)

summary = {
    'total_calls': len(results),
    'successful_calls': sum(1 for r in results if r['call_outcome'] == 'SUCCESSFUL'),
    'unsuccessful_calls': sum(1 for r in results if r['call_outcome'] == 'UNSUCCESSFUL'),
    'calls': results
}
os.makedirs('outputs', exist_ok=True)
with open('outputs/dashboardData.json', 'w', encoding='utf-8') as f:
    json.dump(summary, f, indent=2)
print('PHASE 1 DONE! Saved outputs/dashboardData.json with', len(results), 'demo calls!')
