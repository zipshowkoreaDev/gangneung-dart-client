pipeline {
    agent any

    stages {
        stage('Git Config 설정') {
            steps {
                bat """
                git config --global user.name "zipshowkorea4"
                git config --global user.email "zipshowkorea4@gmail.com"
                """
            }
        }

        stage('Clone Repository') {
            steps {
                git branch: 'main', url: 'https://github.com/zipshowkoreaDev/gangneung-dart-client'
            }
        }

        stage('Get Commit Message') {
            steps {
                script {
                    env.GIT_COMMIT_MSG = bat(script: "@git log -1 --pretty=%%B", returnStdout: true).trim()
                }
            }
        }

        stage('Build and Run Docker Compose') {
            steps {
                script {
                    bat """
                    cd
                    docker-compose up -d --build
                    """
                }
            }
        }
    }

    post {
        success {
            slackSend (
                color: '#36a64f', // 초록색
                message: """
                    *Build Success*
                    *Job:* `${env.JOB_NAME}`
                    *Build Number:* #${env.BUILD_NUMBER}
                    <${env.BUILD_URL}|View Build>
                    Branch: `${env.GIT_BRANCH}`
                    Commit: `${env.GIT_COMMIT_MSG}`
                    """
            )
        }
        failure {
            slackSend (
                color: '#FF0000', // 빨간색
                message: """
                    *Build Failed*
                    *Job:* `${env.JOB_NAME}`
                    *Build Number:* #${env.BUILD_NUMBER}
                    <${env.BUILD_URL}|View Build>
                    Branch: `${env.GIT_BRANCH}`
                    Commit: `${env.GIT_COMMIT_MSG}`
                    """
            )
        }
    }
}
