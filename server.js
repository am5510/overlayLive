import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const app = express();
const server = createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY) : null;
const STORAGE_BUCKET = 'overlay-logos';
const STORAGE_FOLDER = 'logos';

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.get('/ping', (_req, res) => res.status(200).send('ok'));
app.get('/', (_req, res) => res.redirect('/control.html'));
app.use(express.static('public', { etag: false, lastModified: false }));

function sanitizeFileName(fileName = '', fallback = 'logo.png') {
  const raw = String(fileName || fallback).split(/[\\/]/).pop() || fallback;
  const clean = raw.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/\.+/g, '.').trim();
  return clean || fallback;
}

async function ensureStorageBucket() {
  if (!supabase) return false;
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.warn('Supabase storage listBuckets failed:', listError.message);
    return false;
  }
  const exists = buckets?.some((bucket) => bucket.name === STORAGE_BUCKET);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
      fileSizeLimit: '10MB'
    });
    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      console.warn('Supabase storage bucket create failed:', createError.message);
      return false;
    }
  }
  return true;
}

async function uploadCustomLogoToStorage(dataUrl, fileName) {
  if (!supabase || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return '';
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) return '';

  const [, mimeType, base64Payload] = match;
  const extension = mimeType.split('/')[1] || 'png';
  const safeName = sanitizeFileName(fileName || `logo-${Date.now()}.${extension}`);
  const path = `${STORAGE_FOLDER}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(base64Payload, 'base64');

  const bucketReady = await ensureStorageBucket();
  if (!bucketReady) return '';

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false
  });
  if (error) {
    console.warn('Supabase logo upload failed:', error.message);
    return '';
  }

  const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);
  return publicUrlData.publicUrl || '';
}

const defaultProfiles = [
  ['NATTHAWAT S.', 'HOST · LIVE FROM BANGKOK'], ['PIMCHANOK W.', 'CO-HOST · LIVE FROM BANGKOK'],
  ['THANAPOL K.', 'GUEST SPEAKER'], ['SIRIPORN N.', 'PRODUCER'], ['KITTIPONG C.', 'COMMENTATOR'],
  ['MAYURA T.', 'FIELD REPORTER'], ['PHURIT P.', 'ANALYST'], ['ARISA L.', 'SPECIAL GUEST'],
  ['NARONG R.', 'CAMERA OPERATOR'], ['SUPANEE J.', 'LIVE MODERATOR']
].map(([name, role], index) => ({ id: index + 1, name, role }));

function createDefaultState() {
  return {
    visible: true,
    theme: 'cyan',
    name: 'NATTHAWAT S.',
    role: 'HOST · LIVE FROM BANGKOK',
    avatar: 'NS',
    motion: 'slide',
    cornerLogo: 'logo1',
    customLogo: '',
    customLogoName: '',
    organizationName: 'LIVE STUDIO',
    organizationRole: 'BROADCAST UNIT',
    organizationLogo: '',
    organizationLogoName: '',
    profiles: defaultProfiles.map((p) => ({ ...p })),
    activeProfile: 1,
    timer: {
      visible: false,
      mode: 'countdown',
      position: 'center',
      showBg: true,
      durationSec: 600,
      baseSec: 600,
      running: false,
      startedAt: null
    },
    updatedAt: Date.now()
  };
}

const CHANNEL_TABLES = {
  '1': {
    state: 'overlay_state',
    profiles: 'profiles',
    projects: 'projects',
    cornerLogos: 'corner_logos',
      qa: 'Q&A'
    },
  '2': {
    state: 'overlay_state2',
    profiles: 'profiles2',
    projects: 'projects2',
    cornerLogos: 'corner_logos2',
      qa: 'Q&A2'
    }
};

const states = {
  '1': createDefaultState(),
  '2': createDefaultState()
};

const channelRestored = {
  '1': false,
  '2': false
};

function normalizeChannel(ch) {
  return String(ch) === '2' ? '2' : '1';
}

async function restoreChannel(ch) {
  ch = normalizeChannel(ch);
  const tables = CHANNEL_TABLES[ch];
  if (!supabase) return false;

  const { data, error } = await supabase.from(tables.state).select('data').eq('id', 1).maybeSingle();
  if (error) {
    console.warn(`[Channel ${ch}] Supabase restore skipped (${tables.state}):`, error.message);
    if (ch === '2' && channelRestored['1']) {
      // Seed Channel 2 in-memory state from Channel 1 until Channel 2 tables are created
      states['2'] = JSON.parse(JSON.stringify(states['1']));
    }
    return false;
  }
  if (data?.data) {
    states[ch] = { ...states[ch], ...data.data, updatedAt: Date.now() };
  }

  // Fetch relational data
  const { data: profilesData, error: profilesErr } = await supabase.from(tables.profiles).select('*').order('id');
  if (!profilesErr && profilesData && profilesData.length > 0) {
    states[ch].profiles = profilesData;
  }

  const { data: projectsData, error: projectsErr } = await supabase.from(tables.projects).select('*').order('id');
  if (!projectsErr && projectsData && projectsData.length > 0) {
    const savedProjects = states[ch].projects || [];
    states[ch].projects = projectsData.map((proj) => {
      const saved = savedProjects.find((p) => p.id === proj.id);
      return { ...saved, ...proj, logo: proj.logo || proj.image_url || saved?.logo || '' };
    });
  } else if (!states[ch].projects || states[ch].projects.length === 0) {
    states[ch].projects = [{ id: 1, name: 'LIVE MAIN' }, { id: 2, name: 'INTERVIEW' }, { id: 3, name: 'BREAKING NEWS' }];
  }

      const { data: logosData, error: logosErr } = await supabase.from(tables.cornerLogos).select('*').order('id');
    if (!logosErr && logosData && logosData.length > 0) {
      states[ch].cornerLogos = logosData;
    } else {
      states[ch].cornerLogos = [{ id: 1, name: 'logo1' }];
    }

    const { data: qaData, error: qaErr } = await supabase.from(tables.qa).select('*').order('id');
    if (!qaErr && qaData && qaData.length > 0) {
      states[ch].qaList = qaData;
    } else if (!states[ch].qaList || states[ch].qaList.length === 0) {
      states[ch].qaList = [
        { id: 1, question: '' },
        { id: 2, question: '' },
        { id: 3, question: '' },
        { id: 4, question: '' }
      ];
    }

  channelRestored[ch] = true;
  return true;
}

async function persist(ch) {
  ch = normalizeChannel(ch);
  const tables = CHANNEL_TABLES[ch];
  if (!supabase) return { ok: false, message: 'Supabase is not configured' };
  const { error } = await supabase.from(tables.state).upsert({ id: 1, data: states[ch], updated_at: new Date().toISOString() });
  if (error) {
    console.warn(`[Channel ${ch}] Supabase save failed (${tables.state}):`, error.message);
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

function broadcast(ch) {
  ch = normalizeChannel(ch);
  io.to(`channel:${ch}`).emit('overlay:state', states[ch]);
  void persist(ch);
}

io.on('connection', async (socket) => {
  const ch = normalizeChannel(socket.handshake.query?.channel);
  socket.join(`channel:${ch}`);

  if (!channelRestored[ch]) {
    await restoreChannel(ch);
  }

  socket.emit('overlay:state', states[ch]);

  socket.on('overlay:update', async (patch) => {
    let nextPatch = { ...patch };

    for (const [field, fileNameField] of [['customLogo', 'customLogoName'], ['organizationLogo', 'organizationLogoName']]) {
      if (nextPatch[field] && typeof nextPatch[field] === 'string' && nextPatch[field].startsWith('data:image/')) {
        const uploadedUrl = await uploadCustomLogoToStorage(nextPatch[field], nextPatch[fileNameField] || 'logo.png');
        if (uploadedUrl) {
          nextPatch = { ...nextPatch, [field]: uploadedUrl, [fileNameField]: nextPatch[fileNameField] || 'logo.png' };
        } else {
          nextPatch = { ...nextPatch, [fileNameField]: nextPatch[fileNameField] || 'logo.png' };
        }
      }
    }

    states[ch] = { ...states[ch], ...nextPatch, updatedAt: Date.now() };
    broadcast(ch);
  });

  socket.on('overlay:selectProfile', (id) => {
    const profile = states[ch].profiles.find((person) => person.id === Number(id));
    if (!profile) return;

    if (profile.organization_logo !== undefined) {
      states[ch].organizationLogo = profile.organization_logo;
    }

    states[ch] = { ...states[ch], ...profile, activeProfile: profile.id, activeMode: 'profile', visible: true, updatedAt: Date.now() };
    broadcast(ch);
  });

  socket.on('overlay:selectProject', (id) => {
    const project = (states[ch].projects || []).find((proj) => proj.id === Number(id));
    if (!project) return;

    if (project.logo !== undefined && project.logo !== '') {
      states[ch].organizationLogo = project.logo;
    }

    states[ch] = {
      ...states[ch],
      name: project.name,
      role: '',
      activeProject: project.id,
      activeMode: 'project',
      visible: true,
      updatedAt: Date.now()
    };
    broadcast(ch);
  });

  socket.on('overlay:saveProfile', async ({ id, name, role, organizationLogo }, done = () => {}) => {
    id = Number(id);
    if (!Number.isInteger(id)) return done({ ok: false, message: 'Invalid person' });

    const tables = CHANNEL_TABLES[ch];
    let uploadedLogoUrl = organizationLogo;

    if (organizationLogo && typeof organizationLogo === 'string' && organizationLogo.startsWith('data:image/')) {
      uploadedLogoUrl = await uploadCustomLogoToStorage(organizationLogo, `ch${ch}-profile-${id}-orglogo.png`);
      if (!uploadedLogoUrl) {
        return done({ ok: false, message: 'Failed to upload logo' });
      }
    }

    const updateData = {
      name: String(name).slice(0, 48),
      role: String(role).slice(0, 64)
    };
    if (uploadedLogoUrl !== undefined) {
      updateData.organization_logo = uploadedLogoUrl;
    }

    if (supabase) {
      const { error } = await supabase.from(tables.profiles).update(updateData).eq('id', id);
      if (error) {
        console.warn(`[Channel ${ch}] Failed to update profile in DB (${tables.profiles}):`, error.message);
        return done({ ok: false, message: error.message });
      }
    }

    const profiles = states[ch].profiles.map((person) => person.id === id ? { ...person, ...updateData } : person);
    states[ch] = {
      ...states[ch],
      profiles,
      ...(states[ch].activeMode !== 'project' && states[ch].activeProfile === id ? profiles.find((p) => p.id === id) : {}),
      updatedAt: Date.now()
    };

    if (states[ch].activeMode !== 'project' && states[ch].activeProfile === id && uploadedLogoUrl) {
      states[ch].organizationLogo = uploadedLogoUrl;
    }

    io.to(`channel:${ch}`).emit('overlay:state', states[ch]);
    done(await persist(ch));
  });

  socket.on('overlay:saveProject', async ({ id, name, logo }, done = () => {}) => {
    id = Number(id);
    if (!Number.isInteger(id)) return done({ ok: false, message: 'Invalid project' });
    const cleanName = String(name || '').trim().slice(0, 300);
    if (!cleanName) return done({ ok: false, message: 'Project name is required' });

    const tables = CHANNEL_TABLES[ch];
    let uploadedLogoUrl = logo;
    if (logo && typeof logo === 'string' && logo.startsWith('data:image/')) {
      const url = await uploadCustomLogoToStorage(logo, `ch${ch}-project-${id}-logo.png`);
      if (url) uploadedLogoUrl = url;
    }

    if (supabase) {
      const { error } = await supabase.from(tables.projects).update({ name: cleanName }).eq('id', id);
      if (error) {
        console.warn(`[Channel ${ch}] Failed to update project in DB (${tables.projects}):`, error.message);
      }
    }

    const projects = (states[ch].projects || []).map((proj) =>
      proj.id === id
        ? { ...proj, name: cleanName, ...(uploadedLogoUrl !== undefined ? { logo: uploadedLogoUrl } : {}) }
        : proj
    );
    states[ch] = {
      ...states[ch],
      projects,
      ...(states[ch].activeMode === 'project' && states[ch].activeProject === id
        ? { name: cleanName, role: '', ...(uploadedLogoUrl ? { organizationLogo: uploadedLogoUrl } : {}) }
        : {}),
      updatedAt: Date.now()
    };
    io.to(`channel:${ch}`).emit('overlay:state', states[ch]);
    const saved = await persist(ch);
    done(saved.ok ? saved : { ok: true });
  });

  socket.on('overlay:selectQa', (id) => {
    const numId = Number(id);
    states[ch] = { ...states[ch], activeQa: numId, qaVisible: true, updatedAt: Date.now() };
    broadcast(ch);
  });

  socket.on('overlay:saveQa', async ({ qaList }, done = () => {}) => {
    const tables = CHANNEL_TABLES[ch];
    if (supabase && qaList && Array.isArray(qaList)) {
      try {
        for (const q of qaList) {
          await supabase.from(tables.qa).upsert({ id: q.id, question: q.question });
        }
      } catch (err) {
        console.warn(`[Channel ${ch}] Failed to upsert Q&A in DB (${tables.qa}):`, err.message);
      }
    }
    states[ch] = { ...states[ch], qaList, updatedAt: Date.now() };
    broadcast(ch);
    done({ ok: true });
  });

  socket.on('overlay:trigger', ({ type }) => {
    io.to(`channel:${ch}`).emit('overlay:trigger', { type, id: Date.now() });
  });
});

await restoreChannel('1');
await restoreChannel('2');
await ensureStorageBucket();

const requestedPort = Number(process.env.PORT) || 3000;
server.listen(requestedPort, '0.0.0.0', () => {
  console.log(`Overlay Studio Ch1: http://localhost:${requestedPort}/control.html  | http://localhost:${requestedPort}/overlay.html`);
  console.log(`Overlay Studio Ch2: http://localhost:${requestedPort}/control2.html | http://localhost:${requestedPort}/overlay2.html`);
});
