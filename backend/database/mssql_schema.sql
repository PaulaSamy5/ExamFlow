-- SQL Server Script: Create Database and Tables for Exam Management Web Application

-- 1. Create the Database if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'ExamsDB')
BEGIN
    CREATE DATABASE ExamsDB;
END
GO

USE ExamsDB;
GO

-- 2. Core Tables Implementation

-- Users Table
IF OBJECT_ID('Users', 'U') IS NULL
BEGIN
    CREATE TABLE Users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(255) NOT NULL UNIQUE,
        password NVARCHAR(255) NOT NULL,
        name NVARCHAR(255) NOT NULL,
        role NVARCHAR(50) NOT NULL DEFAULT 'STUDENT',
        createdAt DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT CHK_User_Role CHECK (role IN ('INSTRUCTOR', 'STUDENT'))
    );
END
GO

-- Exams Table
IF OBJECT_ID('Exams', 'U') IS NULL
BEGIN
    CREATE TABLE Exams (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX),
        totalGrade FLOAT NOT NULL,
        duration INT NOT NULL, -- in minutes
        startTime DATETIME2 NOT NULL,
        endTime DATETIME2 NOT NULL,
        instructorId INT NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT FK_Exams_Users FOREIGN KEY (instructorId) REFERENCES Users(id) ON DELETE NO ACTION
    );
END
GO

-- Questions Table
IF OBJECT_ID('Questions', 'U') IS NULL
BEGIN
    CREATE TABLE Questions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        examId INT NOT NULL,
        type NVARCHAR(50) NOT NULL,
        text NVARCHAR(MAX) NOT NULL,
        points FLOAT NOT NULL,
        options NVARCHAR(MAX), -- Stored as JSON string
        correctAnswer NVARCHAR(MAX),
        CONSTRAINT FK_Questions_Exams FOREIGN KEY (examId) REFERENCES Exams(id) ON DELETE CASCADE,
        CONSTRAINT CHK_Question_Type CHECK (type IN ('MCQ', 'TRUE_FALSE', 'FILL_BLANKS', 'ESSAY', 'CODING'))
    );
END
GO

-- Submissions Table
IF OBJECT_ID('Submissions', 'U') IS NULL
BEGIN
    CREATE TABLE Submissions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        studentId INT NOT NULL,
        examId INT NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
        score FLOAT DEFAULT 0,
        submittedAt DATETIME2,
        createdAt DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT FK_Submissions_Users FOREIGN KEY (studentId) REFERENCES Users(id) ON DELETE NO ACTION,
        CONSTRAINT FK_Submissions_Exams FOREIGN KEY (examId) REFERENCES Exams(id) ON DELETE NO ACTION,
        CONSTRAINT CHK_Submission_Status CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'GRADED'))
    );
END
GO

-- Answers Table
IF OBJECT_ID('Answers', 'U') IS NULL
BEGIN
    CREATE TABLE Answers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        submissionId INT NOT NULL,
        questionId INT NOT NULL,
        studentAnswer NVARCHAR(MAX) NOT NULL,
        scoreEarned FLOAT DEFAULT 0,
        isCorrect BIT DEFAULT 0,
        CONSTRAINT FK_Answers_Submissions FOREIGN KEY (submissionId) REFERENCES Submissions(id) ON DELETE CASCADE,
        CONSTRAINT FK_Answers_Questions FOREIGN KEY (questionId) REFERENCES Questions(id) ON DELETE NO ACTION
    );
END
GO

