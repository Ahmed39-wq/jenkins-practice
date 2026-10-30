export const STAGES = [
  {
    key: 'checkout',
    title: 'Checkout',
    hint: 'fetches the Jenkinsfile',
    text: 'Jenkins checks the repo every minute. When it sees a new commit, it fetches the Jenkinsfile and starts a build.',
    code: "triggers {\n  scm('* * * * *')\n}",
  },
  {
    key: 'test',
    title: 'Test',
    hint: 'fresh container, stops on failure',
    text: 'Every build starts a new node:18 container, so nothing left over from an earlier build can hide a problem. If a test fails, the pipeline stops here and nothing is deployed.',
    code: "agent {\n  docker { image 'node:18' }\n}\n\nsh 'npm test'",
  },
  {
    key: 'build',
    title: 'Build',
    hint: 'compiles this page',
    text: 'npm ci installs exactly what the lockfile lists, then Vite builds the page. If the page doesn’t compile, the build fails here, before anything is published.',
    code: "dir('site') {\n  sh 'npm ci'\n  sh 'npm run build'\n}",
  },
  {
    key: 'deploy',
    title: 'Deploy',
    hint: 'calls Render',
    text: 'When everything passes, Jenkins calls Render’s deploy hook. The hook’s address is a secret, so it sits in Jenkins’s credentials store and never in git.',
    code: "withCredentials([string(\n  credentialsId: 'render-deploy-hook',\n  variable: 'HOOK')]) {\n  sh 'curl -fsS \"$HOOK\"'\n}",
  },
]

export const PLACES = [
  {
    title: 'The repo',
    what: 'Everything that can be written in a file.',
    items: [
      'The Jenkinsfile',
      'The plugin list and server settings',
      'The Dockerfile',
      'The Node tests and this React app',
    ],
    fate: 'Clone it and you have all of it back.',
  },
  {
    title: 'The image',
    what: 'A snapshot built from the repo.',
    items: [
      'Jenkins and its plugins',
      'The admin login, job and trigger',
      'The Docker command-line tool',
    ],
    fate: 'Rebuilt with one command. It stays as it was until you rebuild it.',
  },
  {
    title: 'The volume',
    what: 'What Jenkins writes while it runs.',
    items: ['Build history', 'Jobs and credentials created by clicking'],
    fate: 'Survives a removed container, not a deleted volume.',
  },
]
