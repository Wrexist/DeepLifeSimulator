export const maleFirstNames = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Christopher',
  'Charles', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua',
  'Kenneth', 'Kevin', 'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan',
  'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon',
  'Frank', 'Benjamin', 'Gregory', 'Raymond', 'Samuel', 'Patrick', 'Alexander', 'Jack', 'Dennis', 'Jerry',
  'Tyler', 'Aaron', 'Jose', 'Adam', 'Nathan', 'Henry', 'Douglas', 'Zachary', 'Peter', 'Kyle',
  'Walter', 'Ethan', 'Jeremy', 'Harold', 'Seth', 'Christian', 'Mason', 'Austin', 'Frederick', 'Evan',
  'Dylan', 'Sean', 'Noah', 'Cameron', 'Hunter', 'Adrian', 'Gavin', 'Connor', 'Aiden', 'Jackson',
  'Ian', 'Caleb', 'Isaac', 'Luke', 'Owen', 'Nathaniel', 'Leo', 'Lucas', 'Marcus', 'Victor',
];

export const femaleFirstNames = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen',
  'Nancy', 'Lisa', 'Betty', 'Helen', 'Sandra', 'Donna', 'Carol', 'Ruth', 'Sharon', 'Michelle',
  'Laura', 'Emily', 'Kimberly', 'Deborah', 'Dorothy', 'Ashley', 'Amanda', 'Stephanie', 'Nicole', 'Angela',
  'Samantha', 'Brenda', 'Catherine', 'Diane', 'Cynthia', 'Marie', 'Janet', 'Margaret', 'Rachel', 'Megan',
  'Brittany', 'Natalie', 'Heather', 'Victoria', 'Amber', 'Hannah', 'Grace', 'Chloe', 'Tiffany', 'Tammy',
  'Julia', 'Danielle', 'Kelly', 'Christina', 'Jacqueline', 'Rose', 'Sofia', 'Ella', 'Lily', 'Harper',
  'Penelope', 'Aria', 'Scarlett', 'Eleanor', 'Nora', 'Hazel', 'Aurora', 'Savannah', 'Audrey', 'Brooklyn',
  'Leah', 'Zoe', 'Stella', 'Paisley', 'Skylar', 'Violet', 'Claire', 'Luna', 'Naomi', 'Elena',
  'Caroline', 'Rebecca', 'Allison', 'Abigail', 'Madeline', 'Adriana', 'Gabriella', 'Vanessa', 'Isabelle', 'Olivia',
];

export const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes'
];

export const generateRandomName = (sex: 'male' | 'female' | 'random' = 'random') => {
  const firstNameArray = sex === 'male' ? maleFirstNames : 
                        sex === 'female' ? femaleFirstNames : 
                        Math.random() > 0.5 ? maleFirstNames : femaleFirstNames;
  
  const randomFirstName = firstNameArray[Math.floor(Math.random() * firstNameArray.length)];
  const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  return {
    firstName: randomFirstName,
    lastName: randomLastName
  };
};
