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
