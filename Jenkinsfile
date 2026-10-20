pipeline {
    agent any
    stages {
        stage('Hello') {
            steps {
                echo 'Hell, Version 2'
            }
        }
        stage('Check') {
            steps {
                sh 'echo Running on: $(hostname)'
            }
        }
    }
}
