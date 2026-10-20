pipeline {
    agent any
    stages {
        stage('Hello') {
            steps {
                echo 'Hello from a Jenkinsfile in git. Reverting previous changes'
            }
        }
        stage('Check') {
            steps {
                sh 'echo Running on: $(hostname)'
            }
        }
    }
}
