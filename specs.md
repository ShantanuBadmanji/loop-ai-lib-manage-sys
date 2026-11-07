# Loopr AI — Backend Engineering Assignment

## Objective
Design and build a Library Management System for a university.

The university currently manages its library operations manually and wants a digital system to manage its books, students, and day-to-day lending activities.

Your task is to understand the problem, identify the necessary functionality, and build a backend application that supports these 
operations.

## 1. The Problem
The university library maintains thousands of books, with multiple copies of many titles.

Two primary types of users interact with the system:

*Librarians* are responsible for maintaining the book catalogue, managing inventory, issuing and receiving books, and keeping track of library activities.

*Students* should be able to discover books, check availability, borrow books, and manage their borrowing activity.

The university also wants better visibility into which books are available, which are currently issued, and when unavailable books might become available again.

The system should preserve important historical information so that library activities can be tracked over time.

## 2. Some Business Constraints
- A book may have multiple physical copies.
- Each physical copy can only be issued to one student at a time.
The standard borrowing period is 14 days.
- Only registered and authorized users should be able to access relevant operations.
- The system should remain consistent even when multiple users perform operations simultaneously.

Beyond these constraints, you are expected to identify reasonable requirements and define how the system should behave in different scenarios.

## 3. Your Task
Design and implement a backend system that addresses the problem.

We expect you to make decisions about:
- The features and workflows required for different users.
- Database structure and relationships.
- APIs needed to support the application.
- Business validations and edge cases.
- Authentication and access control.
Handling of concurrent operations and failures.
- Testing and application reliability.

You are free to make reasonable assumptions where requirements are not explicitly defined. Document important assumptions and explain your decisions.

## 4. Technology & Deployment
**Preferred Stack:** Node.js, TypeScript, NestJS, MongoDB.

Your application should be containerized using Docker and runnable on another developer's machine.

Consider how the application would be deployed, configured, monitored, and maintained in a cloud environment such as AWS.

Actual cloud deployment is optional.

## 5. Submission
Submit a GitHub repository containing:
- Working backend implementation.
- Database schema/models.
- API documentation.
- Automated tests.
- Docker configuration.
- README with setup instructions, assumptions, and key design decisions.

You may use AI tools during development. However, you should understand and be able to explain your implementation.

## 6. Additional Considerations
Think about how the system should behave in situations such as:
- A student wants a book that is currently unavailable.
- Multiple students attempt to borrow the last available copy.
- A book is returned late, damaged, or not returned at all.
- A librarian needs to correct an incorrect transaction.
- A book is removed from the catalogue despite having previous borrowing records.

You are not required to implement every possible feature. Prioritize what you believe is essential and explain your choices.

## 7. What We're Looking For
We are interested in how you approach an open-ended engineering problem.

We will consider the completeness of your solution, quality of implementation, handling of edge cases, and the reasoning behind your technical decisions.

**There is no single correct solution. We value thoughtful trade-offs, clear assumptions, and reliable implementation over unnecessary complexity.**


