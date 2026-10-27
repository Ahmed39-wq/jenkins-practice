pipeline {
    agent {
        docker { image 'node:18' }
    }
    stages {
        stage('Install') {
            steps {
                sh 'npm install'
            }
        }
        stage('Test') {
            steps {
                sh 'npm test'
            }
        }
        stage('Secret demo') {
            steps {
                withCredentials([string(credentialsId: 'demo-api-key', variable: 'API_KEY')]) {
                    sh 'echo "The key is $API_KEY"'
                }
            }
        }
    }
}
