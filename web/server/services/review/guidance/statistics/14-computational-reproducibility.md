# Computational Reproducibility - AI Agent Guidance Document

## Core Definition

**Computational Reproducibility**: Using the same data as in a published article, you can reproduce the same results. If authors send you their data and code, you should be able to get the exact same numbers they report.

**Current Problem**: Research shows it is often not possible to run original code on data to reproduce results. Code may not run, or not all analyses are included in the code.

---

## 1. Key Concepts

### Computational Reproducibility
- Minimum standard for scientific workflow
- Allows others to verify results and build on them
- Prevents "data rot" - inability to reproduce your own analyses after time passes
- Goal: Someone else (or yourself, one year from now) can take your data, run your code, and get exactly the same results

### Open Data
- Share data in stable, long-term repositories (not just GitHub)
- Use persistent identifiers (DOI) for linking in publications
- Requires participant permission in informed consent forms
- Must handle personally identifying information responsibly
- Store data safely and share responsibly

### Open Code
- All analysis code should be shared alongside data
- Code must be runnable and produce exact reported results
- Should include version information for all dependencies
- Use relative paths, not absolute paths

### Version Control
- Track changes to files over time
- Ability to revert to previous versions
- Essential for collaborative work and long-term projects
- Git/GitHub/GitLab are standard tools

---

## 2. Guidelines & Best Practices

### File Naming Conventions
- Keep names short but clear (e.g., `data_analysis_project` not `dat_an_prjct`)
- Never use spaces - use underscores (`this_is_a_file.R`), camelcase (`ThisIsAFile.R`), or dashes (`this-is-a-file.R`)
- Use leading zeroes for numbered files: `01`, `02`, not `1`, `2`
- Avoid special characters: `$#&*{}:`
- Use YYYYMMDD format for dates

### Repository Setup
- Add a README file with:
  - Detailed project description
  - Instructions on how to reproduce analyses
  - Order in which files should be run
  - Any necessary file modifications
- Add a LICENSE:
  - MIT license for minimal restrictions with attribution
  - Creative Commons for non-software materials
  - No license = exclusive copyright (prevents reuse)

### Code Organization & Documentation
- Follow TIER protocol for file organization
- Create clear folder structure:
  - Original data files
  - Analysis data files
  - Scripts/code
  - Output files
- Include a codebook for all datasets:
  - Define all variables clearly
  - Describe all values
  - Use same language as the article
- Annotate code extensively:
  - Explain what each section does
  - Indicate order of execution for multiple scripts
  - Link code sections to manuscript results (copy-paste result sentences into code)
  - List all required packages at the top
  - Document package versions (use `sessionInfo()` or packrat)

### R Markdown Best Practices
- Combine text and code in single document
- Compile to create reproducible reports (HTML/PDF)
- Every number and figure traced back to exact code
- Makes errors reproducible and easier to identify/correct
- Use setup sections to define global options
- Embed R code in text using backticks: `` `r code_here` ``

### Version Control Workflow
- Commit frequently with descriptive messages
- Push changes to remote repository regularly
- Use meaningful commit messages describing changes made
- Stage only relevant files for each commit

### Data Storage & Archiving
- GitHub is NOT a long-term data repository (company-owned, no guarantees)
- Use stable repositories for publications:
  - Open Science Framework (OSF)
  - Domain-specific repositories
  - University repositories
- Create registrations for stable snapshots
- Generate DOIs for persistent linking
- Link GitHub to OSF for integrated workflow

### Dependency Management
- List all packages/libraries at script top
- Report version numbers of all packages
- Use tools like:
  - Renv (R dependency management)
  - Groundhog (R dependency management)
  - Docker (containerization)
  - Code Ocean (cloud-based reproducibility platform)
- Containers preserve entire computing environment

### Path Management
- Use relative paths, never absolute paths (e.g., not `"c:/user/myfolder/code"`)
- RStudio projects facilitate relative paths
- Use the 'here' package in R for path management

---

## 3. Common Mistakes & Pitfalls

### Critical Issues That Break Reproducibility

1. **Missing Codebook**
   - Data is difficult to understand without variable descriptions
   - Variables and values must be clearly described
   - Codebook and variable names should be in same language as article

2. **Poorly Annotated Code**
   - Unclear what code does
   - Unknown order for running multiple scripts
   - No connection between code output and manuscript results

3. **Outdated Code After Revisions**
   - Code not updated after peer review changes
   - Analysis files don't match final manuscript
   - Common oversight during revision process

4. **Missing or Incorrect Package Information**
   - Required packages not listed
   - Package versions not documented
   - Packages update over time, breaking old code

5. **Absolute File Paths**
   - Code uses machine-specific paths
   - Folder structures differ between computers
   - Breaks when others try to run code

6. **Missing Execution Order**
   - Multiple scripts with unclear sequence
   - No README indicating which files to run first
   - Pre-processing steps not documented

7. **Incomplete Code**
   - Not all analyses included in shared code
   - Some results generated manually
   - Copy-pasted values instead of computed values

8. **No License**
   - Default exclusive copyright prevents reuse
   - Others cannot legally use your work
   - Simple oversight with major consequences

9. **Data Privacy Violations**
   - Sharing personally identifying information
   - No participant consent for data sharing
   - Violation of GDPR or other regulations

10. **Platform-Dependent Code**
    - Code only works on specific operating systems
    - No documentation of system requirements
    - Installation instructions missing

---

## 4. Verification Checklists

### Pre-Publication Reproducibility Checklist

#### Data Files
- [ ] All data files included
- [ ] Codebook provided with clear variable descriptions
- [ ] Data and codebook in same language as article
- [ ] No personally identifying information (or proper consent obtained)
- [ ] Data stored in stable, long-term repository
- [ ] DOI generated for data

#### Code Files
- [ ] All analysis code included
- [ ] Code produces all reported results
- [ ] No manual/copy-pasted values in manuscript
- [ ] Code well-annotated and commented
- [ ] All required packages listed at top of script
- [ ] Package versions documented (sessionInfo() output included)
- [ ] Execution order clear (README or numbered files)
- [ ] Relative paths used (no absolute paths)
- [ ] Code tested on fresh installation/different machine

#### Documentation
- [ ] README file with project overview
- [ ] Instructions for reproducing analyses
- [ ] Order of script execution documented
- [ ] System requirements listed
- [ ] License added (MIT, CC, etc.)
- [ ] Link between code sections and manuscript results clear

#### Version Control
- [ ] Repository properly initialized
- [ ] Meaningful commit messages used
- [ ] Final version tagged/released
- [ ] Code matches published manuscript
- [ ] Updated after peer review revisions

#### Archiving
- [ ] Files uploaded to stable repository (OSF, etc.)
- [ ] Registration created for permanent snapshot
- [ ] DOI generated for citation
- [ ] GitHub repository linked (if applicable)
- [ ] Project made public (unless embargo period)

#### Peer Review Support
- [ ] View-only links created for reviewers (if needed)
- [ ] Anonymous links for blinded review (if needed)
- [ ] All materials accessible to reviewers

---

### Code Review Checklist for AI Agents

When reviewing code for reproducibility, verify:

#### Structure
- [ ] Clear folder organization
- [ ] Consistent naming conventions
- [ ] README present and informative
- [ ] License file included

#### Code Quality
- [ ] Comments explain what code does
- [ ] Variable names are descriptive
- [ ] Code is modular and organized
- [ ] No hard-coded values that should be parameters
- [ ] Error handling present

#### Reproducibility
- [ ] All dependencies listed
- [ ] Version information provided
- [ ] Relative paths only
- [ ] Seed set for random processes
- [ ] Data loading code included
- [ ] Output matches what's expected

#### Execution
- [ ] Code runs without errors
- [ ] Produces expected output files
- [ ] Figures match manuscript
- [ ] Numbers match manuscript
- [ ] All steps automated (no manual intervention)

---

## 5. Reporting Requirements

### Data Availability Statement

Required elements:
- Where data is stored (repository name and URL)
- Persistent identifier (DOI)
- Any access restrictions or embargo periods
- Contact information if data cannot be made public

Example:
> "Data and code are available at the Open Science Framework: https://doi.org/10.17605/OSF.IO/XXXXX"

### Code Availability Statement

Required elements:
- Where code is stored (repository name and URL)
- Persistent identifier (DOI)
- Programming language and version
- List of dependencies with versions
- Instructions for running code

Example:
> "All analysis code is available at https://github.com/username/project (archived at https://doi.org/10.17605/OSF.IO/XXXXX). Analyses were conducted in R version 4.0.0. See repository README for package dependencies and execution instructions."

### Materials Availability Statement

Required elements:
- Location of materials (stimuli, surveys, protocols)
- Persistent identifier
- License information
- Any restrictions on use

### Complete Transparency Statement Template

> "We report how we determined our sample size, all data exclusions (if any), all manipulations, and all measures in the study. All data, analysis code, and research materials are available at [repository] ([DOI]). The study was [preregistered/not preregistered]."

---

## 6. Tools and Practices

### Essential Tools

#### Version Control
- **Git**: Version control system for tracking changes
- **GitHub**: Web-based hosting service for Git repositories
  - Integrates with OSF
  - Industry standard
  - Free for public repositories
- **GitLab**: Open-source alternative to GitHub
  - Self-hosting options
  - Similar functionality

#### R Ecosystem
- **R**: Statistical programming language
- **RStudio**: Integrated development environment
  - Built-in Git integration
  - Project management
  - RMarkdown support
- **RMarkdown**: Combine code and text for reproducible documents
  - Generate HTML, PDF, or Word output
  - Code executed each compilation
  - Ensures numbers/figures match code
- **papaja**: R package for APA-formatted manuscripts
  - Reproducible APA 6th edition formatting
  - Integrates with RMarkdown

#### Dependency Management
- **sessionInfo()**: R function to document package versions
- **packrat**: R package dependency management
- **Renv**: Modern R dependency management
- **Groundhog**: Date-based R package versioning
- **Docker**: Containerization for complete environment reproduction
- **Code Ocean**: Cloud-based computational reproducibility platform
  - Easy to create computing capsules
  - Runs online with all dependencies
  - Allows others to modify and re-run code
  - Not guaranteed long-term storage

#### Data Repositories
- **Open Science Framework (OSF)**:
  - Free data/code storage
  - GitHub integration
  - Registration for permanent snapshots
  - DOI generation
  - View-only links for reviewers
- **Zenodo**: General-purpose repository
- **Dataverse**: Multi-disciplinary repository
- **Domain-specific repositories**: Check journal recommendations

#### Documentation Tools
- **README files**: Project overview and instructions
- **Codebook generators**: Automate variable documentation
- **TIER Protocol**: Standard for organizing files and documentation

---

### Recommended Workflow

1. **Project Initialization**
   - Create GitHub/GitLab repository
   - Add README and LICENSE
   - Clone to local machine
   - Create RStudio project (for R users)
   - Set up folder structure (TIER protocol)

2. **Development**
   - Write code in RMarkdown (or similar literate programming tool)
   - Commit changes frequently with descriptive messages
   - Push to remote repository regularly
   - Document as you go (don't wait until end)

3. **Analysis**
   - Use reproducible analysis scripts
   - Avoid point-and-click (use syntax/scripts)
   - Embed all values in documents (no copy-paste)
   - Generate all figures from code
   - Set seeds for random processes

4. **Documentation**
   - Create comprehensive README
   - Write detailed codebook
   - Add code comments
   - Link code to manuscript results
   - Document all dependencies and versions

5. **Pre-Publication**
   - Test code on fresh installation
   - Verify all results reproduce exactly
   - Update code after peer review revisions
   - Create stable repository registration
   - Generate DOI
   - Make project public (unless embargo)

6. **Publication**
   - Include data/code availability statements
   - Link to repositories using DOI
   - Consider creating Code Ocean capsule for easy exploration
   - Share view-only links with reviewers during review

---

## 7. Advanced Practices

### Containerization
- Preserves entire computing environment
- Solves "works on my machine" problem
- Docker is standard but complex
- Code Ocean provides easier alternative
- Essential for long-term reproducibility as software evolves

### Continuous Integration
- Automatically test code on each commit
- Verify reproducibility continuously
- Catch breaking changes early
- GitHub Actions, Travis CI, etc.

### Pre-registration Integration
- Store pre-registrations in same repository
- Link to OSF pre-registration
- Document deviations in analysis code/manuscript
- Transparently report unplanned analyses

### Peer Review Integration
- Share materials during review via view-only links
- Use anonymous links for blinded review
- Makes it easier for reviewers to verify claims
- Increases trust in findings

### Computational Notebooks
- Jupyter Notebooks (Python, R, Julia, etc.)
- R Notebooks
- Combine code, output, and narrative
- Execute and display results inline
- Export to multiple formats

---

## 8. AI Agent-Specific Guidance

### When Helping Scientists Verify Reproducibility

#### Ask These Questions
1. "Can you share the data and code files?"
2. "Is there a README explaining how to run the code?"
3. "Are all required packages listed with versions?"
4. "Do you use relative or absolute file paths?"
5. "Is there a codebook explaining the variables?"
6. "Has this code been tested on a different machine?"
7. "Where will you archive this for long-term storage?"
8. "Have you added a license to your repository?"

#### Red Flags to Check For
- Missing documentation
- Absolute file paths
- Unlisted dependencies
- No version information
- Copy-pasted values in manuscripts
- Incomplete code coverage
- Missing data files
- No license
- GitHub-only storage (no stable archive)
- Code not updated after revisions

#### Verification Steps
1. Check file structure and organization
2. Review README for completeness
3. Verify all dependencies listed
4. Look for absolute paths
5. Check for codebook
6. Verify license present
7. Confirm stable repository (not just GitHub)
8. Check code matches manuscript results
9. Look for commit history and meaningful messages
10. Verify DOI exists or will be created

#### Recommendations to Provide
- Template README files
- Codebook examples
- License recommendations (MIT for code, CC for materials)
- Folder structure suggestions (TIER protocol)
- Repository recommendations (OSF, Zenodo, etc.)
- Workflow improvements (RMarkdown, version control)
- Testing procedures (run on fresh machine)

---

## 9. Common Scenarios & Solutions

### Scenario: "I can't reproduce my own results from 6 months ago"
**Problem**: Data rot - unclear how outliers were handled, code doesn't work, settings not saved

**Solution**:
- Implement version control immediately
- Create RMarkdown document that runs from raw data to final results
- Document all decisions in code comments
- Use reproducible workflow going forward

### Scenario: "My code works on my computer but not others'"
**Problem**: Absolute paths, missing dependencies, platform-specific code

**Solution**:
- Convert to relative paths (use RStudio projects, 'here' package)
- List all dependencies with versions at script top
- Test on different machine/fresh installation
- Consider containerization (Docker, Code Ocean)

### Scenario: "I need to share code with reviewers but keep it anonymous"
**Problem**: Blinded peer review requires anonymity

**Solution**:
- Create anonymous view-only link on OSF
- Hide contributor names in project
- Share link in manuscript
- Make public after acceptance

### Scenario: "My analysis code is too long and complex"
**Problem**: Single monolithic script is hard to understand

**Solution**:
- Break into logical sections with clear headers
- Create multiple numbered scripts (01_preprocessing.R, 02_analysis.R)
- Add README explaining execution order
- Use RMarkdown sections
- Comment extensively

### Scenario: "I made changes during peer review"
**Problem**: Original code doesn't match final manuscript

**Solution**:
- Update code to match final manuscript
- Test that code reproduces final results
- Commit with message "Updated for final manuscript"
- Create registration/DOI of final version

### Scenario: "I have personally identifying data"
**Problem**: Cannot share raw data publicly

**Solution**:
- Verify consent forms allow data sharing
- Create de-identified dataset
- Share de-identified data with codebook
- Document de-identification process
- Store identifiable data securely (not in public repository)
- Consider restricted access repository

---

## 10. Key Principles to Emphasize

### Embracing Errors
- Everyone makes mistakes in analysis
- Reproducibility makes errors reproducible
- Reproducible errors are easier to find and fix
- Sharing code requires accepting fallibility
- Science benefits from ability to identify and correct mistakes

### Transparency Over Perfection
- Better to share imperfect but honest code than hide it
- Deviations from plans should be documented, not hidden
- Unknown decisions during preregistration are normal
- Note where you deviated from preregistration transparently

### Computational Reproducibility as Minimum Standard
- Not the same as replication or robustness
- Minimum threshold for scientific work
- Allows verification before building on results
- Investment in skills that save time long-term

### Long-term Thinking
- Consider your future self as user
- Think about scientists who will build on your work
- Stable storage matters for decade+ timescales
- Good practices save time in long run (revisions, future projects)

### Community Benefit
- Reproducible work is more useful to others
- Easier to build on well-documented code
- Increases impact and citations
- Contributes to scientific progress

---

## Resources & References

### Recommended Reading
- TIER Protocol: https://www.projecttier.org/tier-protocol/
- RMarkdown Guide: https://rmarkdown.rstudio.com/lesson-1.html
- OSF Registration Guide: https://help.osf.io/article/158-create-a-preregistration
- Git/SVN in RStudio: https://support.rstudio.com/hc/en-us/articles/200532077
- Choose a License: https://choosealicense.com/
- Creative Commons: https://creativecommons.org/choose/
- Open Science Manual: https://arca-dpss.github.io/manual-open-science/

### Example Projects
- GitHub Example: https://github.com/Lakens/reproducibility_assignment
- OSF Example: https://osf.io/jky8s/
- Code Ocean Example: https://codeocean.com/capsule/2529779/tree/v1

### Tools Documentation
- Git: https://git-scm.com/downloads
- R: https://cran.r-project.org/
- RStudio: https://www.rstudio.com/products/rstudio/download/
- papaja: https://github.com/crsh/papaja
- OSF: https://osf.io/
- GitHub: https://github.com/
- GitLab: https://www.gitlab.com
- Code Ocean: https://codeocean.com/

---

## Summary: Core Actions for Reproducibility

1. **Use version control** (Git/GitHub) from project start
2. **Write reproducible analysis documents** (RMarkdown) that combine code and text
3. **Organize files systematically** (TIER protocol)
4. **Document extensively** (README, codebook, code comments)
5. **List all dependencies with versions** (sessionInfo(), packrat)
6. **Use relative paths only** (RStudio projects, 'here' package)
7. **Add a license** (MIT, CC, etc.)
8. **Archive in stable repository** (OSF, Zenodo, not just GitHub)
9. **Generate persistent identifiers** (DOI)
10. **Test on fresh installation** before publication
11. **Update after revisions** and verify reproducibility
12. **Make public when ready** (or provide view-only links for review)

**Remember**: Computational reproducibility is achievable with training and practice. It improves research quality, saves time in the long run, and benefits the entire scientific community.
