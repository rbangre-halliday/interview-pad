export interface Language {
  id: string
  name: string
  piston_name: string
  piston_version: string
  monaco_id: string
  template: string
}

export const LANGUAGES: Language[] = [
  {
    id: 'python3',
    name: 'Python 3',
    piston_name: 'python',
    piston_version: '*',
    monaco_id: 'python',
    template: `# Write your solution here
def solution():
    pass

if __name__ == "__main__":
    solution()
`,
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    piston_name: 'javascript',
    piston_version: '*',
    monaco_id: 'javascript',
    template: `// Write your solution here
function solution() {

}

solution();
`,
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    piston_name: 'typescript',
    piston_version: '*',
    monaco_id: 'typescript',
    template: `// Write your solution here
function solution(): void {

}

solution();
`,
  },
  {
    id: 'java',
    name: 'Java',
    piston_name: 'java',
    piston_version: '*',
    monaco_id: 'java',
    template: `public class Main {
    public static void main(String[] args) {
        // Write your solution here
    }
}
`,
  },
  {
    id: 'c',
    name: 'C',
    piston_name: 'c',
    piston_version: '*',
    monaco_id: 'c',
    template: `#include <stdio.h>

int main() {
    // Write your solution here
    return 0;
}
`,
  },
  {
    id: 'cpp',
    name: 'C++',
    piston_name: 'c++',
    piston_version: '*',
    monaco_id: 'cpp',
    template: `#include <iostream>
using namespace std;

int main() {
    // Write your solution here
    return 0;
}
`,
  },
]
