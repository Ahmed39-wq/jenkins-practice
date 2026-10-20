pipeline {
    agent any
    stages {
        stage('Hello') {
            steps {
                echo 'Hello from a Jenkinsfile in git'
            }
        }
        stage('Check') {
            steps {
                sh 'echo Running on: $(hostname)'
            }
        }
    }
}
