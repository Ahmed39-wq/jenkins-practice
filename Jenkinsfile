pipeline {
    agent any
    stages {
        stage('Hello') {
            steps {
                echo 'Hello from a Jenkinsfile in git. Added triggers to Jenkins'
            }
        }
        stage('Check') {
            steps {
                sh 'echo Running on: $(hostname)'
            }
        }
    }
}
