/* =========================================================
   generate-audio.cjs — Nice-Pak Onboarding Portal audio
   Spark Companies

   Generates studio-quality neural voice MP3s for every
   Listen button in the portal using Azure Speech.

   SETUP (one time):
   1. Azure Portal > Create resource > "Speech" (F0 free tier
      is plenty — this whole script is ~15 min of audio).
   2. Grab KEY 1 and the region from the resource overview.

   RUN (Git Bash):
     export SPEECH_KEY="your-key-here"
     export SPEECH_REGION="eastus"        # your resource region
     node generate-audio.cjs

   OUTPUT: ./audio/*.mp3  (one file per Listen button)

   DEPLOY: copy the audio/ folder next to the portal HTML,
   then set  const AUDIO_BASE = 'audio/';  in the portal.
   Browser TTS remains as automatic fallback if a file 404s.
========================================================= */

const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY = process.env.SPEECH_KEY;
const REGION = process.env.SPEECH_REGION || 'eastus';
if (!KEY) { console.error('Set SPEECH_KEY (and SPEECH_REGION) first.'); process.exit(1); }

/* ---------- VOICES ----------
   Emma and Ava Multilingual are Azure's current flagship voices —
   noticeably more natural than the older Jenny/Aria generation.
   AUDITION FIRST:  node generate-audio.cjs --sample
   generates one short clip per candidate voice in ./audio/ so you
   can listen and pick, then set VOICE_EN below and run for real.
   HD tier (best available, preview, works in eastus/westus2/
   southeastasia): 'en-US-Emma:DragonHDLatestNeural' — try it in
   sample mode; if your region rejects it the script just skips it. */
const VOICE_EN = 'en-US-EmmaMultilingualNeural';
const VOICE_ES = 'es-MX-DaliaNeural';
const SAMPLE_VOICES = [
  'en-US-EmmaMultilingualNeural',   // warm, natural narrator (recommended)
  'en-US-AvaMultilingualNeural',    // bright, energetic
  'en-US-AndrewMultilingualNeural', // male, calm authority
  'en-US-Emma:DragonHDLatestNeural',// HD preview — most human, region-limited
  'es-MX-DaliaNeural',              // Spanish (Mexico) female
  'es-MX-JorgeNeural'               // Spanish (Mexico) male
];
const SAMPLE_TEXT_EN = `Welcome to Nice-Pak orientation. Safety rules are written to protect everyone. They are not optional, and they apply to everyone equally. When you are near a forklift: stop, make eye contact with the driver, and wait for the driver's signal.`;
const SAMPLE_TEXT_ES = `Bienvenido a la orientación de Nice-Pak. Las reglas de seguridad están escritas para proteger a todos. No son opcionales y se aplican a todos por igual.`;
const RATE = '-4%';                      // slightly slower than default for comprehension
const OUT = path.join(__dirname, 'audio');

/* ---------- portal section texts (plain, speech-ready) ---------- */
const S = {

'neo0': `Safety Culture. All associates shall adhere to all safety policies established at Nice-Pak. Safety rules are written to protect everyone. They are not optional, and they apply to everyone equally. Everyone is authorized to bring safety concerns to any supervisor, any manager, any safety committee member — they wear the red bump caps — or the E H S and Sustainability team.`,

'neo1': `Emergency Procedures. The types of emergencies are fire, severe weather, chemical, and intruder. Pull station colors: fire is red. Severe weather is green. Chemical is yellow. If you see a fire: one, activate the fire alarm. Two, decide fight or flight — fight only if you are trained. Three, evacuate the building. For a severe weather alarm, such as a tornado: go to the nearest storm shelter, and do not leave until instructed by management or security. Protect your head and neck: sit on the floor, raise your knees, tuck your head between your knees, and cover the back of your head with your arms crossed over your neck. For a chemical emergency alarm: go to your department's designated meeting area, and stay until you are given the all-clear. For an intruder, bomb, or other threat: supervisors are notified by phone with instructions. Follow instructions quickly and quietly. Only evacuate if you are specifically instructed to. Do not pick up personal items. And do not make phone calls.`,

'neo2': `Working Safely Around Forklifts. A loaded forklift can weigh eight thousand eight hundred pounds. Always be aware of your surroundings. Check mirrors at intersections for oncoming traffic. Drivers sound their horns at intersections and in joint-use areas. The pedestrian procedure is: Stop, when a forklift is close. Speak, if the driver is unaware. See — make eye contact with the driver. And Signal — wait for the driver's signal. Always walk in designated pedestrian areas when you are able.`,

'neo3': `Safe Lifting and Ergonomics. About one third of injuries are ergonomic. Treat your back well — it's the only one you have. Keep lifts in the power zone. Take a wide stance, tighten your stomach muscles, and use smooth, even motions. Use your legs to push up and lift — never your upper body or back. Keep the load close to your body. Stand up straight before walking, and move your feet instead of twisting. Lower loads by bending your knees, not your back, and keep your hands and feet clear. Chep pallets require a two-person lift. Lift from the sides when possible, and avoid walking backwards and twisting. For team lifting: communicate with your co-worker, get close to the object, and lift slowly together. At the loading position, wait for the boxes to come to you — do not reach. Keep loads no wider than your shoulders. Support boxes underneath, and don't grip the top. When stacking, start in the middle of the pallet and work outward. At a rotating pallet table, work from the empty side, push gently, and never push with your feet. And remember Flex-Stretch: stretch before each shift to prevent sprains and strains. No overhead reaching, and no prolonged squeezing and twisting.`,

'neo4': `Safe Work Practices and Conveyors. Climbing on machinery, shelving, or racks is not permitted. Cross production lines only at designated crossover locations — otherwise, walk around. Emergency stops are red pull cords or red buttons on the equipment. Never crawl under a conveyor in operating mode. Use a broom to push spilled bottles or boxes out from underneath. Keep your hands clear of the track bed, and never wear loose-fitting gloves, sleeves, or clothing near conveyors. Jewelry is prohibited in production and warehouse areas — that includes watches, earrings, rings, and bracelets. A medical I D is preferred as a necklace, worn inside your clothing. Report all malfunctions and unsafe conditions to your supervisor.`,

'neo5': `Personal Protective Equipment. For your head: bump caps and hard hats protect against falling objects, bumps, and electrical shock. For your eyes: safety glasses guard against flying objects, chemicals, dust, vapors, and light radiation. For your feet: wear closed-toe, low-heel, slip-resistant shoes with a substantial sole. No open toes, no sandals, no high heels. For your ears: use hearing protection where required — plugs, canal caps, or muffs. To insert an ear plug: make sure your hands are clean, roll the plug between your fingertips, insert it into your ear canal, hold it until it expands, then repeat in the other ear. Ladders: only authorized personnel may use step, extension, or fixed ladders. If you are authorized: keep one hand on the rail, face the rungs going up and down, carry no bulky loads, place your full foot on each tread, and take your time.`,

'neo6': `Hazard Communication — your right to know. Nice-Pak provides information on workplace chemicals: the hazards, the risks, and how to protect yourself. You are responsible for working with them safely. Chemicals enter the body four ways: inhalation, through breathing. Absorption, through the skin. Ingestion, by swallowing. And ocular, through the eyes. Acute effects are short-term and appear right after exposure — like rashes, burns, and irritation. Chronic effects appear long after low-level exposure — like cancer or organ damage. Safety data sheets are on the Nice-Pak intranet — get your supervisor. They tell you first aid, health effects, required protective equipment, and spill procedures. Check labels before use for the chemical identity, the manufacturer, and hazard warnings. All containers must be labeled. Treat unlabeled containers as dangerous, and never remove a label. Never smell, inhale, or taste a chemical, and wash your hands and face thoroughly after use. If you see or suspect a spill: notify your supervisor immediately, clear the area, and stay away until the all-clear. Do not attempt cleanup unless you are trained.`,

'neo7': `Electrical Safety, Lockout, and Machine Guarding. Electricity is the most common workplace hazard, and low voltage does not mean low hazard. All cords need a three-prong grounded plug. Never use damaged cords — report them, and remove the equipment from service. Never use electrical equipment if you or the area are wet. Lockout tagout: temporary associates at Nice-Pak are classified as Affected employees. You may not work on locked-out equipment. You must be able to recognize a lockout event, and you must never restart equipment under lockout, or remove locks or tags. Authorized employees carry red personal locks. Machine guarding: if machine parts move, they can injure you, and they must be guarded. Only maintenance may remove a guard. Report broken guards immediately. Any attempt to defeat a guard results in disciplinary action. Confined spaces — tanks, pits, silos, manholes — require additional training to enter. Signs are posted. Stay out. Bloodborne pathogens: treat all human blood and bodily fluids as infectious. If you find blood, fluids, or needles: notify security, reception, or your supervisor. The trained emergency response team cleans it up — not you. Use the collection boxes in the restrooms for needles.`,

'saf0': `Facility Rules. No running or horseplay. No cell phones on the floor. Never crawl under or step over conveyors for any reason. No loose, baggy, or flowing clothing. Only use designated walkways, and do not travel through the warehouse without permission. Smoking is only permitted in the designated area outside. Report any spill, leak, or fluid on the floor immediately. Remove trip hazards immediately: bottles, caps, banding, cords, and hoses.`,

'saf1': `Forklifts and Pedestrians. When near a forklift: stop, make eye contact with the driver, and wait for the driver's signal before moving. Always stay at least an arm's length away from forklifts. Always use the pedestrian door. Never go through a forklift door.`,

'saf2': `Machine Guarding. Never reach into, or place any body part into, machinery. Never operate a machine with a missing or broken guard — report it immediately. Never remove or bypass a guard. Always access equipment through the interlocked door or panel, and verify the machine is not moving.`,

'saf3': `Pallet Safety. All chep — the blue pallets — require two people for any movement. White wood pallets are slid on their side, never dropped or thrown. Keep all pallets horizontal, and never stack more than seven high. Do not step or stand on pallets.`,

'saf4': `Personal Protective Equipment. Bump hats are required in all production areas. Non-slip shoes or shoe covers are required in all packaging areas. Safety glasses: wear approved safety glasses if you don't wear prescription glasses. Prescription wearers need side shields, or safety glasses designed to cover prescription glasses. Some jobs require a full face shield worn over safety glasses. Hearing protection is required in all production areas. No jewelry in production areas — medical or religious necklaces must be secured under clothing. Gloves: nitrile gloves when open product is handled. Heat-resistant gloves near hot surfaces. Cut-resistant gloves in case sealers, box makers, and the Citrate area. And standard work gloves when handling corrugate.`,

'saf5': `Quality Basics. Hair and beard nets are required in all production areas. Long sleeves or arm covers are required on the production line, until after the capper. Temporary associates must wear their agency shirt with the logo. Food is only permitted in the breakroom. Artificial fingernails and nail polish require gloves.`,

'gown': `Gowning Instructions. Remove your hair net and beard cover before entering the restroom, break area, or smoking area. Apply a new hair net and beard cover at the gowning station before entering: manufacturing, the weigh room, and compounding areas.`,

'cgmp': "The cGMP Question Bank. These are the official questions your test draws from. Work through each card and choose the answer you believe is right. You will see immediately whether you got it. The portal will not show you the answers; earn them here, so they are yours on the test. C G M P stands for current Good Manufacturing Practices, the F D A rules for how drug products are made. Everything in this bank matters on the floor: cleanliness, honest documentation, line clearance, and doing things right the first time. The test requires eighty percent to pass, with a maximum of two attempts. Take your time here.",

'lunch': "Lunch Break and Rounding Disclosure. Lunch breaks: if you work more than 6 hours, you will have a 30 minute lunch break, where half, 15 minutes, is unpaid. If you work any time during your scheduled lunch break, or do not take a lunch break, let your agency representative know by the end of the payroll period to avoid any payroll discrepancies. All times are verified by the Nice-Pak management team. Rounding: while on assignment at Nice-Pak, you will be issued a badge and must clock in at the beginning of your shift, and out at the end of your shift. Unless you have prior authorization for overtime from Nice-Pak, your in-punch is rounded to the start of your shift, and your out-punch is rounded to the end of your shift. If you work any time outside your scheduled shift, beyond the 5 minute grace period, let your agency representative know by the end of the payroll period. By acknowledging, you confirm you understand that a 15 minute lunch break is deducted from your time daily, that your punches are rounded to your scheduled shift, and that it is your responsibility to tell your agency representative if you worked during lunch or outside your shift, so your pay is never delayed.",

'sec-en': `Building Security Acknowledgment. Building security is both critical and important. Everyone has a part when it comes to building security. We have entryways into our facility that can only be accessed by having an active badge. For your safety, and the safety of all: Do not permit anyone to use your badge. Do not share your badge or your badge access. Do not hold the door open for another person. Do not prop a door open. And do not exit through the emergency exit, unless during an emergency. If you lose your badge, or your badge stops working, get with H R to receive a new badge. You can also contact your supervisor to gain access to the facility until you get a new badge from H R. Building security is top priority. By signing, you are stating that you understand and will adhere to building security as outlined. Failure to abide by building security will result in corrective action, up to and including termination of employment.`,

'sec-es': {voice:'ES', text:`Reconocimiento de Seguridad del Edificio. La seguridad del edificio es crítica e importante. Todos tienen un papel en la seguridad del edificio. Tenemos entradas a nuestras instalaciones a las que solo se puede acceder con una credencial activa. Para su seguridad y la seguridad de todos: No permita que nadie use su credencial. No comparta su credencial ni su acceso. No mantenga la puerta abierta para otra persona. No deje una puerta abierta. Y no salga por la salida de emergencia, a menos que sea durante una emergencia. Si pierde su credencial o deja de funcionar, comuníquese con Recursos Humanos para recibir una nueva. También puede comunicarse con su supervisor para obtener acceso a la instalación hasta que reciba una nueva credencial. La seguridad del edificio es la máxima prioridad. Al firmar, usted declara que comprende y se adherirá a la seguridad del edificio como se describe. El incumplimiento dará lugar a una acción correctiva que puede incluir la terminación del empleo.`}
};

/* ---------- Azure Speech REST ---------- */
function esc(t){ return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function ssml(text, voice, xmlLang){
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${xmlLang}">` +
    `<voice name="${voice}"><prosody rate="${RATE}">${esc(text)}</prosody></voice></speak>`;
}
function synth(key, text, voice, xmlLang){
  return new Promise((resolve, reject)=>{
    const body = ssml(text, voice, xmlLang);
    const req = https.request({
      hostname: `${REGION}.tts.speech.microsoft.com`,
      path: '/cognitiveservices/v1',
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-48khz-96kbitrate-mono-mp3',
        'User-Agent': 'spark-vijon-onboarding',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res=>{
      if(res.statusCode !== 200){
        let err=''; res.on('data',d=>err+=d);
        res.on('end',()=>reject(new Error(`${key}: HTTP ${res.statusCode} ${err}`)));
        return;
      }
      const chunks=[]; res.on('data',d=>chunks.push(d));
      res.on('end',()=>resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

(async ()=>{
  if(!fs.existsSync(OUT)) fs.mkdirSync(OUT);

  /* --------- audition mode: node generate-audio.cjs --sample --------- */
  if(process.argv.includes('--sample')){
    console.log('Audition mode — one clip per candidate voice -> ./audio/\n');
    for(const v of SAMPLE_VOICES){
      const isES = v.startsWith('es-');
      const text = isES ? SAMPLE_TEXT_ES : SAMPLE_TEXT_EN;
      const xmlLang = isES ? 'es-MX' : 'en-US';
      const fname = 'sample-' + v.replace(/[^A-Za-z0-9]+/g,'-') + '.mp3';
      process.stdout.write(`  ${fname} ... `);
      try{
        const buf = await synth(v, text, v, xmlLang);
        fs.writeFileSync(path.join(OUT, fname), buf);
        console.log(`${Math.round(buf.length/1024)} KB`);
      }catch(e){ console.log('skipped — ' + (e.message.includes('400')?'not available in this region':e.message)); }
      await new Promise(r=>setTimeout(r, 400));
    }
    console.log(`\nListen to the samples, set VOICE_EN / VOICE_ES at the top of this file, then run:  node generate-audio.cjs`);
    return;
  }

  const only = process.argv.slice(2).filter(a=>!a.startsWith('--'));
  const keys = only.length ? Object.keys(S).filter(k=>only.includes(k)) : Object.keys(S);
  if(only.length) console.log(`Selective regen: ${keys.join(', ')}`);
  console.log(`Generating ${keys.length} files -> ${OUT}\n`);
  for(const k of keys){
    const entry = S[k];
    const isES = typeof entry === 'object' && entry.voice === 'ES';
    const text = isES ? entry.text : entry;
    const voice = isES ? VOICE_ES : VOICE_EN;
    const xmlLang = isES ? 'es-MX' : 'en-US';
    process.stdout.write(`  ${k}.mp3 (${voice}) ... `);
    try{
      const buf = await synth(k, text, voice, xmlLang);
      fs.writeFileSync(path.join(OUT, `${k}.mp3`), buf);
      console.log(`${Math.round(buf.length/1024)} KB`);
    }catch(e){ console.log('FAILED — ' + e.message); }
    await new Promise(r=>setTimeout(r, 400)); // be polite to the endpoint
  }
  console.log(`\nDone. Copy the audio/ folder next to the portal HTML and set AUDIO_BASE = 'audio/' in the file.`);
})();
