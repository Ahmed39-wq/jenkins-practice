# Jenkins practice: a server and pipeline defined as code

A practice project that builds a complete CI/CD:

- **Jenkins** runs in a Docker container, and the whole server (plugins, settings, login, job, trigger) is defined by files in this repo.
- **A pipeline** (the `Jenkinsfile`) tests the project, builds a React site, and deploys it.
- **Render** hosts the site. It only publishes when Jenkins calls its deploy hook, which only happens after the tests and build pass.

If the server is destroyed, it can be rebuilt from this repo alone.

---

## 1. Core ideas

### Jenkins vs a Jenkinsfile

| | What it is |
|---|---|
| **Jenkins** | A server that runs automation (build, test, deploy). |
| **Jenkinsfile** | A text file of instructions Jenkins follows. It lives in the repo, so the pipeline gets git history, review, and rollback. |

Think of Jenkins as the oven and the Jenkinsfile as the recipe.

### Pipeline vocabulary

- **Stages** run in order. A failed stage stops everything after it.
- **`when`** skips a stage on purpose. A skipped stage is not a failure.
  - Note: `when { branch 'main' }` only works in *multibranch* pipeline jobs. This project uses a plain pipeline job that only watches `*/main`, so no condition is needed.
- **`post`** blocks (`success`, `failure`) run after the stages, depending on the result.
- **Console Output** of a build starts with why it began: `Started by an SCM change` (trigger) or `Started by user admin` (button click).

### Docker vocabulary

- **Image**: a frozen, read-only template (for example `node:18`, `my-jenkins`).
- **Container**: a running instance of an image. A container can't exist without an image.
- **Volume**: storage kept by Docker outside any container. It holds what a program writes while running.
- **Tag**: a label pointing at an image (`name:version`). Rebuilding with the same tag moves the label to the new image and leaves the old one untagged.

### Where each thing lives

| Location | Holds | After deleting the container and volume |
|---|---|---|
| **Repo (git)** | Jenkinsfile, `jenkins/` folder, Node tests, the React app | Still there |
| **Image (`my-jenkins`)** | Jenkins, plugins, settings, admin login, job, trigger, Docker CLI | Still there. Comes back on every new container |
| **Volume (`jenkins_casc_home`)** | Build history, jobs and credentials created by clicking | Gone |

An image is a **snapshot**. Editing a file does nothing to a running Jenkins until you rebuild the image and start a new container.

---

## 2. Repo layout

```
.
├── Jenkinsfile              the pipeline
├── package.json             Node project (tests)
├── math.js                  code under test (placeholder)
├── math.test.js             the test
├── jenkins/
│   ├── Dockerfile           bakes plugins and settings into an image
│   ├── plugins.txt          plugins to install
│   └── jenkins.yaml         server settings, credentials, job, trigger
└── site/                    React app (Vite), published on Render
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js
    ├── index.html
    └── src/  (main.jsx, App.jsx, content.js, styles.css)
```

---

## 3. The files

### `Jenkinsfile`

```groovy
pipeline {
    agent {
        docker { image 'node:18' }
    }
    environment {
        npm_config_cache = '/tmp/.npm'
    }
    stages {
        stage('Test') {
            steps {
                sh 'npm test'
            }
        }
        stage('Build') {
            steps {
                dir('site') {
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }
        stage('Deploy') {
            steps {
                withCredentials([string(credentialsId: 'render-deploy-hook', variable: 'HOOK')]) {
                    sh 'curl -fsS "$HOOK"'
                }
            }
        }
    }
}
```

- `agent { docker { image 'node:18' } }` runs every step in a fresh `node:18` container, which is thrown away afterwards. Node comes from the image, not from the machine.
- `npm_config_cache` gives npm a writable cache folder inside the container.
- `dir('site')` runs the commands inside the `site` folder.
- The credential **ID** (`render-deploy-hook`) is only a label and is safe in git. The **secret** (the hook URL) lives in Jenkins's credentials store.
- Single quotes around the `sh` command stop Groovy from pasting the secret into the command text, so Jenkins can mask it in the log.
- Jenkins runs a Checkout step automatically before the first stage.

### `jenkins/plugins.txt`

```
workflow-aggregator
git
configuration-as-code
job-dsl
docker-workflow
```

Install only what you need. Every plugin is extra code in the server: more security risk, more updates, more that can break. Teams usually pin versions (for example `git:5.2.0`) for repeatable builds.

### `jenkins/Dockerfile`

```dockerfile
FROM jenkins/jenkins:lts
USER root
RUN apt-get update && apt-get install -y docker.io && rm -rf /var/lib/apt/lists/*
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false"
ENV CASC_JENKINS_CONFIG=/casc_configs/jenkins.yaml
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
COPY jenkins.yaml /casc_configs/jenkins.yaml
```

- `runSetupWizard=false` turns off the "Unlock Jenkins" and plugin screens. `plugins.txt` and `jenkins.yaml` supply what the wizard would have asked for.
- `docker.io` installs only the Docker **command-line tool**. There is no daemon in the container (see section 5).

### `jenkins/jenkins.yaml`

Replace `YOUR-USERNAME` with your GitHub username.

```yaml
jenkins:
  systemMessage: "Jenkins configured as code"
  securityRealm:
    local:
      allowsSignup: false
      users:
        - id: "admin"
          password: "${ADMIN_PASSWORD}"
  authorizationStrategy:
    loggedInUsersCanDoAnything:
      allowAnonymousRead: false

unclassified:
  location:
    url: "http://localhost:8080/"

credentials:
  system:
    domainCredentials:
      - credentials:
          - string:
              scope: GLOBAL
              id: "demo-api-key"
              secret: "${DEMO_API_KEY}"

jobs:
  - script: |
      pipelineJob('hello-pipeline') {
        definition {
          cpsScm {
            scm {
              git {
                remote { url('https://github.com/YOUR-USERNAME/jenkins-practice.git') }
                branch('*/main')
              }
            }
            scriptPath('Jenkinsfile')
          }
        }
        triggers {
          scm('* * * * *')
        }
      }
```

- `${ADMIN_PASSWORD}` and `${DEMO_API_KEY}` are read from environment variables at startup (`-e` on `docker run`), so no secret is written in git.
- `scm('* * * * *')` makes Jenkins poll the repo every minute. A real server would poll less often (for example `H/5 * * * *`).
- YAML is indentation-sensitive. Keep the spacing exactly.
- Config as Code creates configured jobs near the end of startup. If the job is missing right after a restart, wait and refresh before changing anything.

### Node tests

`package.json`:

```json
{
  "name": "jenkins-practice",
  "version": "1.0.0",
  "scripts": {
    "test": "node --test"
  }
}
```

`math.js`:

```js
function add(a, b) {
  return a + b;
}
module.exports = { add };
```

`math.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { add } = require('./math');

test('adds two numbers', () => {
  assert.strictEqual(add(2, 3), 5);
});
```

The test is a placeholder, but it is a real gate: breaking it (for example change `5` to `6`) fails the Test stage, so Build and Deploy never run and the live site stays as it was.

### `site/` (React app)

A Vite + React single-page site (`react`, `react-dom`, `vite`, `@vitejs/plugin-react`). Vite is pinned to version 5 because newer versions need a newer Node than 18. `package-lock.json` is committed so `npm ci` installs exactly what is listed.

`npm audit` reports advisories for `esbuild` and `vite`. They concern Vite's development server, which this project never starts (it only runs `vite build`). Moving to newer Vite means moving the pipeline to a newer Node image.

---

## 4. Setting it up from scratch (Windows)

### Build and run Jenkins

From the `jenkins/` folder (the `.` at the end of `docker build` is required):

```bash
docker build -t my-jenkins .

docker run -d --name jenkins-casc -p 8080:8080 -u root \
  -e ADMIN_PASSWORD=choose-a-password \
  -e DEMO_API_KEY=my-fake-api-key \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v jenkins_casc_home:/var/jenkins_home \
  my-jenkins
```

Wait a minute, then open <http://localhost:8080> and log in as `admin`. The `hello-pipeline` job should already be there.

If an older practice container is still holding port 8080, stop it first (`docker stop jenkins`).

### Render

1. **New > Static Site.** Choose **Git Provider > GitHub**, authorize Render for only this repo, and pick it. Public Git Repository is not used here: per Render's community posts, auto-deploy only works with Git Provider, and Git Provider is the path whose settings this guide matches.
2. Settings:
   - Branch: `main`
   - Root Directory: `site`
   - Build Command: `npm ci && npm run build`
   - Publish Directory: `dist` (not `site`, or Render serves the unbuilt source)
3. In the site's **Settings**, set **Auto-Deploy to Off**.
   - *On commit* would publish every push without waiting for Jenkins.
   - *After CI checks pass* waits for GitHub checks, and Jenkins reports none here, so it would likely never deploy.
4. Copy the **Deploy Hook** URL from the same Settings page. Treat it like a password.

### Store the hook in Jenkins

**Manage Jenkins > Credentials > System > Global credentials > Add Credentials**

- Kind: **Secret text**
- Secret: the deploy hook URL
- ID: `render-deploy-hook` (must match the Jenkinsfile exactly)

---

## 5. How it all fits together

Every push to `main`:

1. Jenkins polls the repo and sees a new commit.
2. It fetches the `Jenkinsfile` and starts a fresh `node:18` container.
3. **Test** runs `npm test`. A failure stops the pipeline here.
4. **Build** runs `npm ci` and `npm run build` in `site/`. A page that doesn't compile fails here.
5. **Deploy** calls Render's deploy hook with the secret from Jenkins's credentials store.
6. Render pulls the commit, runs its own build, and publishes `dist`.

Why build in Jenkins when Render builds again? Without it, a compile error would still give a **green Jenkins build** (the hook call only proves Render accepted the request) and fail later on Render, where nobody is watching. With it, the failure turns Jenkins red and the hook is never called. The published result is the same; the difference is where and when you find out.

### Jenkins runs inside Docker, builds run in other containers

Two Docker command-line tools are involved, and only one has a daemon behind it:

- **Your terminal's `docker`** talks to Docker Desktop on its own.
- **The `docker` inside the Jenkins container** has no daemon. Mounting `/var/run/docker.sock` lets it talk to your machine's daemon, which is how Jenkins starts the `node:18` build containers. Without that mount, the Docker agent fails (your terminal commands are unaffected).

You can verify the link: `docker exec jenkins-casc docker ps` lists your machine's containers, including `jenkins-casc` itself.

---

## 6. Day-to-day routines

### After changing `Dockerfile`, `plugins.txt`, or `jenkins.yaml`

A running container never updates itself. Build, remove, run:

```bash
cd jenkins
git pull
docker build -t my-jenkins .
docker rm -f jenkins-casc
docker run -d --name jenkins-casc -p 8080:8080 -u root \
  -e ADMIN_PASSWORD=choose-a-password \
  -e DEMO_API_KEY=my-fake-api-key \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v jenkins_casc_home:/var/jenkins_home \
  my-jenkins
```

Keeping the same `-v jenkins_casc_home:...` keeps build history and clicked-in credentials.

### The "crashed server" test

Same as above but also delete the volume before `docker run`:

```bash
docker rm -f jenkins-casc
docker volume rm jenkins_casc_home
```

Expected result: login, plugins, job, trigger, and `demo-api-key` come back. Build history, clicked-in jobs, and clicked-in credentials (including `render-deploy-hook`) do not.

### Is the running container stale?

- `docker ps`: if the IMAGE column shows a **name** (`my-jenkins`), the container matches the current tag. A **hex ID** means the tag has moved to a newer image and the container is behind.
- Compare local and baked-in files:

```bash
grep -c "something" jenkins.yaml
docker exec jenkins-casc grep -c "something" /casc_configs/jenkins.yaml
```

### Housekeeping

- `docker images -a` lists all images. Untagged ones are old builds or intermediate layers.
- `docker image prune` deletes dangling images. It reclaims `0B` while a container still uses one.

---

## 7. Flag reference

**`docker run`**

| Flag | Meaning |
|---|---|
| `-d` | Detached: run in the background |
| `--name` | Name the container |
| `-p host:container` | Publish a port (`8080:8080` makes `localhost:8080` reach Jenkins) |
| `-v source:path` | Mount a volume or file at `path` inside the container |
| `-e NAME=value` | Set an environment variable |
| `-u root` | Run as the root user (lets Jenkins use the Docker socket) |
| `-t` | Give the container a pseudo-terminal (Jenkins uses `-t -d` for build containers) |

**Other Docker commands**

| Command | Meaning |
|---|---|
| `docker build -t name .` | `-t` tags the image. `.` is the build context (folder with the Dockerfile and the files it copies) |
| `docker rm -f` | Force-remove, even if running. Removes the container only, never a named volume |
| `docker ps -a` | Include stopped containers |
| `docker stop --time=1` | Wait 1 second, then force stop |
| `docker rm --volumes` | Also remove the container's anonymous volumes (Jenkins uses this to clean up build containers) |

**Other tools**

- `grep`: `-n` line numbers, `-i` ignore case, `-E` patterns like `a|b`, `-c` count only, `-A8` 8 lines after a match.
- `ls -ln`: detailed list with numeric owner IDs.
- `rm -rf`: recursive and forced. Check the path first.
- `apt-get install -y`: answer yes to prompts.

---

## 8. Git Bash on Windows

Git Bash rewrites any argument that **starts with `/`** into a Windows path (`/var/run/docker.sock` becomes `C:\Program Files\Git\var\run\docker.sock`). Docker never sees the original, which causes errors like `mkdir C:\Program Files\Git\var: Access is denied`.

Fixes, any one of them:

- Prefix the command: `MSYS_NO_PATHCONV=1 docker ...`
- Double the leading slash: `//var/run/docker.sock`
- Run `export MSYS_NO_PATHCONV=1` once per Git Bash window
- Use PowerShell instead

Only arguments that start with `/` and refer to something inside a container are affected. `docker ps`, `docker build -t my-jenkins .`, and `docker rm -f jenkins-casc` don't need it.


## 10. Lessons worth remembering

- **An image is a snapshot.** Editing a file changes nothing until you rebuild the image and start a new container.
- **Written-down config comes back; runtime data doesn't.** Anything in git or the image survives a rebuild. Anything clicked into Jenkins lives only in the volume.
- **Keep secrets out of git, even in private repos.** Git history keeps them. Pass them in with `-e` and reference them from `jenkins.yaml` as `${VAR}`.
- **The credential ID is a label; the secret is the value.** Only the label goes in the Jenkinsfile.
- **Masking is a safety net, not a guarantee.** It only matches the exact secret text. Anyone who can edit the Jenkinsfile can still leak a secret.
- **Polling batches commits.** Three commits between polls give one build of the latest commit, and the failing commit can hide inside the batch. Polling works from `localhost` because Jenkins connects outward. A webhook needs Jenkins reachable from the internet.
- **A fresh container per build exposes undeclared dependencies.** A library missing from `package.json` fails immediately instead of being hidden by leftovers.
- **Pausing vs quitting Docker Desktop:** pausing freezes everything in place (the Jenkins page just keeps loading). Closing the window may only hide the app while the engine keeps running.
- **A deploy hook deploys the latest commit on the branch**, not necessarily the one Jenkins just tested. If you push again mid-build, Render could publish the newer commit. Render's docs describe a `ref` parameter on the hook URL to pin a commit.
- **`curl` in the Deploy stage** returning success only means Render accepted the request. Confirm on Render's Deploys page that it was triggered by a deploy hook.

---

## 11. Security notes (fine for practice, not for production)

- Mounting `/var/run/docker.sock` and running as root lets Jenkins control Docker on the whole machine.
- `-e ADMIN_PASSWORD=...` on the command line is visible in shell history. Use a secrets store for real setups.
- The `render-deploy-hook` credential was added by clicking, so it lives in the volume. To make it survive a rebuild, define it in `jenkins.yaml` the same way as `demo-api-key` and pass the value with `-e`:

```yaml
          - string:
              scope: GLOBAL
              id: "render-deploy-hook"
              secret: "${RENDER_DEPLOY_HOOK}"
```

- Never paste the deploy hook URL into chat, files, or the repo. Render can replace it if it leaks.

---

## 12. Possible next steps

- Move `render-deploy-hook` into `jenkins.yaml` (section 11).
- Pin the deploy to the exact commit Jenkins tested using the hook's `ref` parameter.
- Replace polling with a webhook (needs a public address for Jenkins).
- Pin plugin versions in `plugins.txt`.
- Use separate build agents instead of mounting the Docker socket.
- Add real tests for the React app so the Test stage covers the page itself.
- Back up the volume if build history matters.

